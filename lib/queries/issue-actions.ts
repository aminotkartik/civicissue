/**
 * Issue lifecycle & community actions (write side).
 *
 * Every action here enforces, in one place:
 *   permissions → status machine → transactional writes →
 *   timeline events → status history → notifications → audit log
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, withTransaction } from "@/lib/db";
import {
  issues,
  issueImages,
  issueEvents,
  issueStatusHistory,
  comments,
  upvotes,
  follows,
  confirmations,
  feedback,
  users,
  workers,
  departments,
  categories,
} from "@/drizzle/sqlite/schema";
import { uuid } from "@/lib/ids";
import { canTransition, REJECTION_REASON_LABELS } from "@/lib/status/machine";
import { computeSlaDeadline, isOverdue } from "@/lib/sla/engine";
import { computePriority } from "@/lib/priority/engine";
import { getPriorityWeights, getSlaDefaults } from "@/lib/queries/settings";
import { notify, notifyMany } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { fileKeyToUrl } from "@/lib/queries/issues";
import { assertCan, can, ForbiddenError, hasDepartmentScope } from "@/lib/permissions/matrix";
import { OPEN_STATUSES, type IssueStatus, type Priority } from "@/lib/types";
import type { CurrentUser } from "@/lib/auth";

class ActionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ActionError";
  }
}
export { ActionError };

async function loadIssue(idOrPublicId: string) {
  const db = await getDb();
  const rows = await db
    .select({ issue: issues, categoryName: categories.name, categorySlug: categories.slug })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .where(sql`${issues.id} = ${idOrPublicId} OR ${issues.publicId} = ${idOrPublicId.toUpperCase()}`)
    .limit(1);
  if (!rows[0]) throw new ActionError("This complaint could not be found.", 404);
  return rows[0];
}

type Db = Awaited<ReturnType<typeof getDb>>;
/** withTransaction passes the Db itself on SQLite (single connection). */
type Tx = Db;

/** System actor used by automatic processes (SLA sweep). */
export const SYSTEM_ACTOR: CurrentUser = {
  id: "__system__",
  name: "CivicIssue System",
  email: "system@civicissue.local",
  role: "ADMIN",
  departmentId: null,
  phone: null, city: null, locality: null, profileImage: null,
  isActive: true, isSuspended: false, trustScore: 0, createdAt: new Date(),
};

function realActorId(actor: CurrentUser): string | null {
  return actor.id === SYSTEM_ACTOR.id ? null : actor.id;
}

/** Enforce resource-level scoping in addition to the role permission matrix. */
async function assertIssueScope(
  issue: { departmentId: string | null; assignedWorkerId: string | null },
  actor: CurrentUser
): Promise<void> {
  if (actor.id === SYSTEM_ACTOR.id || actor.role === "ADMIN") return;
  if (actor.role === "AUTHORITY") {
    if (!hasDepartmentScope(actor.departmentId, issue.departmentId)) {
      throw new ForbiddenError("This complaint is outside your department scope.");
    }
    return;
  }
  if (actor.role === "WORKER") {
    if (!issue.assignedWorkerId) throw new ForbiddenError("This job is not assigned to you.");
    const db = await getDb();
    const rows = await db.select({ id: workers.id }).from(workers)
      .where(and(eq(workers.id, issue.assignedWorkerId), eq(workers.userId, actor.id), eq(workers.active, true)))
      .limit(1);
    if (!rows[0]) throw new ForbiddenError("You can only access jobs assigned to you.");
    return;
  }
  throw new ForbiddenError();
}

async function assertTransitionPermission(
  issue: { createdById: string; departmentId: string | null; assignedWorkerId: string | null },
  actor: CurrentUser,
  to: IssueStatus,
  resolutionValidated?: boolean
): Promise<void> {
  if (actor.id === SYSTEM_ACTOR.id || actor.role === "ADMIN") return;
  if (actor.role === "AUTHORITY") {
    assertCan(actor.role, "issue:updateStatus");
    await assertIssueScope(issue, actor);
    return;
  }
  if (actor.role === "WORKER") {
    assertCan(actor.role, "worker:updateAssignedJob");
    await assertIssueScope(issue, actor);
    if (to !== "IN_PROGRESS" && !(to === "RESOLVED" && resolutionValidated)) {
      throw new ForbiddenError("Workers can only start or resolve their assigned jobs.");
    }
    return;
  }
  if (actor.role === "CITIZEN" && issue.createdById === actor.id && to === "REOPENED" && can(actor.role, "issue:reopenOwn")) return;
  throw new ForbiddenError();
}

async function addEvent(
  tx: Tx,
  issueId: string,
  type: string,
  message: string,
  opts: { actorId?: string | null; actorRole?: string | null; isPublic?: boolean; metadata?: unknown } = {}
) {
  await tx.insert(issueEvents).values({
    id: uuid(),
    issueId,
    type,
    actorId: opts.actorId ?? null,
    actorRole: opts.actorRole ?? null,
    message,
    isPublic: opts.isPublic ?? true,
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
  });
}

async function followerIds(issueId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ userId: follows.userId }).from(follows).where(eq(follows.issueId, issueId));
  return rows.map((r) => r.userId);
}

async function authorityUserIds(departmentId: string | null): Promise<string[]> {
  const db = await getDb();
  // Authorities scoped to the department + platform-wide authorities (dept null) + admins.
  const rows = await db
    .select({ id: users.id, role: users.role, departmentId: users.departmentId })
    .from(users)
    .where(and(eq(users.isActive, true)));
  return rows
    .filter(
      (u) =>
        u.role === "ADMIN" ||
        (u.role === "AUTHORITY" && departmentId !== null && u.departmentId === departmentId)
    )
    .map((u) => u.id);
}

interface TransitionOpts {
  to: IssueStatus;
  actor: CurrentUser;
  reason?: string | null;
  note?: string | null;
  eventMessage?: string;
  metadata?: Record<string, unknown>;
  /** Set only by resolveIssue after evidence and description validation. */
  resolutionValidated?: boolean;
}

/**
 * Core state-machine transition. Validates the move, writes status +
 * history + event, and dispatches notifications. Caller wraps extras.
 */
export async function transitionStatus(
  issueId: string,
  opts: TransitionOpts
): Promise<void> {
  const { issue } = await loadIssue(issueId);
  await assertTransitionPermission(issue, opts.actor, opts.to, opts.resolutionValidated);
  if (opts.to === "RESOLVED" && !opts.resolutionValidated && opts.actor.id !== SYSTEM_ACTOR.id) {
    throw new ForbiddenError("Use the resolution workflow so evidence and the resolution note are recorded.");
  }
  if (!canTransition(issue.status, opts.to)) {
    throw new ActionError(
      `An issue that is "${issue.status}" cannot be moved to "${opts.to}".`,
      409
    );
  }
  const now = new Date();
  const patch: Partial<typeof issues.$inferSelect> = {
    status: opts.to,
    updatedAt: now,
  };
  if (opts.to === "RESOLVED") patch.resolvedAt = now;
  if (opts.to === "CLOSED") patch.closedAt = now;
  if (["RESOLVED", "CLOSED", "REJECTED"].includes(opts.to)) patch.isOverdue = false;

  await withTransaction(async (tx) => {
    await tx.update(issues).set(patch).where(eq(issues.id, issue.id));
    await tx.insert(issueStatusHistory).values({
      id: uuid(),
      issueId: issue.id,
      fromStatus: issue.status,
      toStatus: opts.to,
      changedById: realActorId(opts.actor),
      reason: opts.reason ?? opts.note ?? null,
    });
    await addEvent(tx, issue.id, opts.to, opts.eventMessage ?? `Status changed to ${opts.to}`, {
      actorId: realActorId(opts.actor),
      actorRole: opts.actor.role,
      metadata: opts.metadata,
    });
  });

  await dispatchTransitionNotifications(issue.id, issue.publicId, opts.to, opts.actor, opts.reason ?? opts.note ?? null);
  await recordAudit(
    opts.actor.id === SYSTEM_ACTOR.id ? null : { id: opts.actor.id, email: opts.actor.email },
    `STATUS_${opts.to}`,
    "ISSUE",
    issue.id,
    { from: issue.status, to: opts.to, reason: opts.reason ?? null }
  );
}

async function dispatchTransitionNotifications(
  issueId: string,
  publicId: string,
  to: IssueStatus,
  actor: CurrentUser,
  reason: string | null
) {
  const { issue } = await loadIssue(issueId);
  const link = `/issues/${publicId}`;
  const followers = await followerIds(issueId);

  const notifyReporter = (type: Parameters<typeof notify>[0]["type"], title: string, message: string, email = true) =>
    notify({ userId: issue.createdById, type, title, message, issueId, link, email });

  switch (to) {
    case "UNDER_REVIEW":
      await notifyReporter("STATUS_CHANGED", "Your report is under review", `Complaint ${publicId} is being reviewed by the authority.`);
      break;
    case "VERIFIED":
      await notifyReporter("ISSUE_VERIFIED", "Your report has been verified", `Complaint ${publicId} was verified and will be assigned to the responsible department.`, true);
      await notifyMany(followers.filter((f) => f !== issue.createdById), {
        type: "STATUS_CHANGED", title: `${publicId} verified`, message: `An issue you follow was verified by the authority.`, issueId, link,
      });
      break;
    case "REJECTED":
      await notifyReporter("ISSUE_REJECTED", "Your report was not accepted", `Complaint ${publicId} was rejected.${reason ? ` Reason: ${reason}` : ""} You can view the details on the issue page.`, true);
      break;
    case "ASSIGNED":
      await notifyReporter("WORKER_ASSIGNED", "A team has been assigned", `Complaint ${publicId} has been assigned for field work.`, true);
      if (issue.assignedWorkerId) {
        const w = await (await getDb()).select({ userId: workers.userId }).from(workers).where(eq(workers.id, issue.assignedWorkerId)).limit(1);
        if (w[0]) {
          await notify({
            userId: w[0].userId, type: "WORKER_ASSIGNED", title: `New job assigned: ${publicId}`,
            message: issue.title, issueId, link: `/worker`, email: true,
          });
        }
      }
      break;
    case "IN_PROGRESS":
      await notifyReporter("STATUS_CHANGED", "Work has started", `Field work on complaint ${publicId} has started.`);
      await notifyMany(followers.filter((f) => f !== issue.createdById), {
        type: "STATUS_CHANGED", title: `${publicId}: work started`, message: issue.title, issueId, link,
      });
      break;
    case "WAITING_FOR_INFORMATION":
      await notifyReporter("INFO_REQUESTED", "The authority needs more information", reason ? `Regarding ${publicId}: ${reason}` : `Please add information to ${publicId}.`, true);
      break;
    case "RESOLVED":
      await notifyReporter("ISSUE_RESOLVED", "Your complaint has been resolved", `Complaint ${publicId} was marked as resolved. Please review the evidence and share your feedback.`, true);
      await notifyMany(followers.filter((f) => f !== issue.createdById), {
        type: "STATUS_CHANGED", title: `${publicId} resolved`, message: issue.title, issueId, link,
      });
      break;
    case "CLOSED":
      await notifyReporter("STATUS_CHANGED", "Your complaint is now closed", `Complaint ${publicId} has been closed. Thank you for helping improve your city.`);
      break;
    case "REOPENED":
      await notifyReporter("ISSUE_REOPENED", "Your complaint has been reopened", `Complaint ${publicId} was reopened and sent back to the responsible team.`);
      for (const uid of await authorityUserIds(issue.departmentId)) {
        await notify({
          userId: uid, type: "ISSUE_REOPENED", title: `Reopened: ${publicId}`,
          message: `${issue.title}${reason ? ` — "${reason.slice(0, 120)}"` : ""}`, issueId, link, email: false,
        });
      }
      break;
    case "ESCALATED":
      for (const uid of await authorityUserIds(issue.departmentId)) {
        await notify({
          userId: uid, type: "ESCALATION", title: `Escalated: ${publicId}`,
          message: `${issue.title} — ${reason ?? "SLA deadline exceeded"}`, issueId, link, email: true,
        });
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Authority actions
// ---------------------------------------------------------------------------

export async function verifyIssue(publicId: string, actor: CurrentUser, note?: string) {
  assertCan(actor.role, "issue:verify");
  const { issue } = await loadIssue(publicId);
  await assertIssueScope(issue, actor);
  // Verifying a freshly submitted report implicitly moves it into review first.
  if (issue.status === "SUBMITTED") {
    await transitionStatus(issue.id, {
      to: "UNDER_REVIEW",
      actor,
      eventMessage: `Moved to review by ${actor.name}`,
    });
  }
  await transitionStatus(issue.id, {
    to: "VERIFIED",
    actor,
    note: note ?? null,
    eventMessage: `Report verified by ${actor.name}`,
  });
  // (Re)compute SLA from the verified moment for the authority clock.
  const db = await getDb();
  const [cat, slaDefaults] = await Promise.all([
    db.select().from(categories).where(eq(categories.id, issue.categoryId)).limit(1),
    getSlaDefaults(),
  ]);
  const deadline = computeSlaDeadline(new Date(), issue.priority, cat[0], slaDefaults);
  await db.update(issues).set({ slaDeadline: deadline }).where(eq(issues.id, issue.id));
}

export async function rejectIssue(
  publicId: string,
  actor: CurrentUser,
  reason: string,
  note?: string
) {
  assertCan(actor.role, "issue:reject");
  const { issue } = await loadIssue(publicId);
  await assertIssueScope(issue, actor);
  const label = REJECTION_REASON_LABELS[reason] ?? reason;
  await transitionStatus(issue.id, {
    to: "REJECTED",
    actor,
    reason: label,
    note: note ? `${label}: ${note}` : label,
    eventMessage: `Report rejected — ${label}${note ? ` (${note})` : ""}`,
  });
}

export async function requestInformation(
  publicId: string,
  actor: CurrentUser,
  message: string
) {
  assertCan(actor.role, "issue:requestInfo");
  const db = await getDb();
  const { issue } = await loadIssue(publicId);
  await assertIssueScope(issue, actor);
  // Information can only be requested once a report is under review.
  if (issue.status === "SUBMITTED") {
    await transitionStatus(issue.id, {
      to: "UNDER_REVIEW",
      actor,
      eventMessage: `Moved to review by ${actor.name}`,
    });
  }
  await db
    .update(issues)
    .set({ verificationRequestedInfo: message })
    .where(eq(issues.id, issue.id));
  await transitionStatus(issue.id, {
    to: "WAITING_FOR_INFORMATION",
    actor,
    reason: message,
    eventMessage: `Authority requested more information: "${message.slice(0, 160)}"`,
  });
}

export async function provideInformation(
  publicId: string,
  actor: CurrentUser,
  message: string,
  imageKeys: string[] = []
) {
  const { issue } = await loadIssue(publicId);
  if (issue.createdById !== actor.id && !can(actor.role, "issue:editAny")) {
    throw new ForbiddenError("Only the reporter can provide this information.");
  }
  await withTransaction(async (tx) => {
    for (let i = 0; i < imageKeys.length; i++) {
      await tx.insert(issueImages).values({
        id: uuid(),
        issueId: issue.id,
        url: fileKeyToUrl(imageKeys[i]!),
        type: "OTHER",
        caption: "Provided by reporter",
        sortOrder: 100 + i,
        uploadedById: actor.id,
      });
    }
    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId: issue.id,
      type: "INFO_PROVIDED",
      actorId: actor.id,
      actorRole: actor.role,
      message: `Reporter provided information: "${message.slice(0, 200)}"`,
      isPublic: true,
    });
    await tx
      .update(issues)
      .set({ status: "UNDER_REVIEW", updatedAt: new Date(), verificationRequestedInfo: null })
      .where(eq(issues.id, issue.id));
    await tx.insert(issueStatusHistory).values({
      id: uuid(),
      issueId: issue.id,
      fromStatus: issue.status,
      toStatus: "UNDER_REVIEW",
      changedById: actor.id,
      reason: "Additional information submitted",
    });
  });
  for (const uid of await authorityUserIds(issue.departmentId)) {
    await notify({
      userId: uid,
      type: "STATUS_CHANGED",
      title: `New information on ${issue.publicId}`,
      message: message.slice(0, 160),
      issueId: issue.id,
      link: `/issues/${issue.publicId}`,
    });
  }
  await recordAudit({ id: actor.id, email: actor.email }, "INFO_PROVIDED", "ISSUE", issue.id);
}

export async function assignIssue(
  publicId: string,
  actor: CurrentUser,
  opts: { departmentId?: string | null; workerId?: string | null; note?: string }
) {
  assertCan(actor.role, "issue:assign");
  const db = await getDb();
  const { issue } = await loadIssue(publicId);
  await assertIssueScope(issue, actor);
  if (!opts.departmentId && !opts.workerId) {
    throw new ActionError("Choose a department or a worker to assign.");
  }
  let workerRow: { id: string; userId: string; name: string; departmentId: string } | null = null;
  if (opts.workerId) {
    const rows = await db
      .select({ id: workers.id, userId: workers.userId, name: users.name, departmentId: workers.departmentId })
      .from(workers)
      .innerJoin(users, eq(workers.userId, users.id))
      .where(and(eq(workers.id, opts.workerId), eq(workers.active, true)))
      .limit(1);
    workerRow = rows[0] ?? null;
    if (!workerRow) throw new ActionError("That worker is not available.");
  }
  const departmentId = opts.departmentId ?? workerRow?.departmentId ?? issue.departmentId;
  if (actor.role === "AUTHORITY" && (departmentId !== actor.departmentId || (workerRow && workerRow.departmentId !== actor.departmentId))) {
    throw new ForbiddenError("Department staff can only assign work within their own department.");
  }
  if (departmentId) {
    const dept = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);
    if (!dept[0]?.active) throw new ActionError("That department is not active.");
  }

  const now = new Date();
  await withTransaction(async (tx) => {
    await tx
      .update(issues)
      .set({ departmentId: departmentId ?? null, assignedWorkerId: workerRow?.id ?? null, updatedAt: now })
      .where(eq(issues.id, issue.id));
    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId: issue.id,
      type: "ASSIGNMENT_UPDATED",
      actorId: actor.id,
      actorRole: actor.role,
      message: workerRow
        ? `Assigned to field worker ${workerRow.name}${opts.note ? ` — "${opts.note}"` : ""}`
        : `Department assignment updated${opts.note ? ` — "${opts.note}"` : ""}`,
      isPublic: true,
      metadata: JSON.stringify({ departmentId, workerId: workerRow?.id ?? null }),
    });
  });

  // Move to ASSIGNED when coming from VERIFIED/REOPENED/ESCALATED.
  const didTransition = canTransition(issue.status, "ASSIGNED");
  if (didTransition) {
    await transitionStatus(issue.id, {
      to: "ASSIGNED",
      actor,
      note: opts.note ?? null,
      eventMessage: workerRow
        ? `Assigned to ${workerRow.name} for field work`
        : "Assigned to the responsible department",
    });
  }
  // The ASSIGNED transition dispatch already notifies the worker; only send
  // directly when reassigning without a status change.
  if (workerRow && !didTransition) {
    await notify({
      userId: workerRow.userId,
      type: "WORKER_ASSIGNED",
      title: `New job assigned: ${issue.publicId}`,
      message: `${issue.title} — ${issue.locality ?? issue.city ?? ""}`,
      issueId: issue.id,
      link: `/worker`,
      email: true,
    });
  }
  await recordAudit(
    { id: actor.id, email: actor.email },
    "ISSUE_ASSIGNED",
    "ISSUE",
    issue.id,
    { departmentId, workerId: workerRow?.id ?? null }
  );
}

export async function escalateIssue(publicId: string, actor: CurrentUser, reason?: string) {
  assertCan(actor.role, "issue:escalate");
  const { issue } = await loadIssue(publicId);
  await assertIssueScope(issue, actor);
  await transitionStatus(issue.id, {
    to: "ESCALATED",
    actor,
    reason: reason ?? "Escalated by authority",
    eventMessage: `Escalated — ${reason ?? "requires senior attention"}`,
  });
}

export async function resolveIssue(
  publicId: string,
  actor: CurrentUser,
  input: { description: string; imageKeys: string[]; resolvedDate?: string | null }
) {
  // Workers may resolve only their own assigned jobs; authority/admin any.
  const { issue } = await loadIssue(publicId);
  if (actor.role === "WORKER") {
    await assertIssueScope(issue, actor);
  } else {
    assertCan(actor.role, "issue:resolve");
    await assertIssueScope(issue, actor);
  }
  // Evidence policy: HIGH/CRITICAL resolutions require an after photo.
  if (["HIGH", "CRITICAL"].includes(issue.priority) && input.imageKeys.length === 0) {
    throw new ActionError(
      "A resolution photo is required before closing a high or critical priority issue."
    );
  }
  const now = input.resolvedDate ? new Date(input.resolvedDate) : new Date();

  await withTransaction(async (tx) => {
    for (let i = 0; i < input.imageKeys.length; i++) {
      await tx.insert(issueImages).values({
        id: uuid(),
        issueId: issue.id,
        url: fileKeyToUrl(input.imageKeys[i]!),
        type: "AFTER",
        caption: "Resolution evidence",
        sortOrder: 200 + i,
        uploadedById: actor.id,
      });
    }
    await addEvent(tx, issue.id, "RESOLUTION_EVIDENCE", `Resolution recorded: "${input.description}"`, {
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { resolvedDate: now.toISOString() },
    });
  });

  await transitionStatus(issue.id, {
    to: "RESOLVED",
    actor,
    note: input.description,
    eventMessage: `Issue resolved — ${input.description.slice(0, 200)}`,
    metadata: { resolvedDate: now.toISOString() },
    resolutionValidated: true,
  });
}

/**
 * Field progress update (spec §39): workers post notes and PROGRESS photos
 * while a job is underway; reporters and followers are notified.
 */
export async function postProgressUpdate(
  publicId: string,
  actor: CurrentUser,
  input: { message: string; imageKeys: string[] }
) {
  const { issue } = await loadIssue(publicId);
  if (!["ASSIGNED", "IN_PROGRESS", "REOPENED", "ESCALATED"].includes(issue.status)) {
    throw new ActionError("Progress updates can only be added while work is underway.", 409);
  }
  if (actor.role === "WORKER") {
    await assertIssueScope(issue, actor);
  } else {
    assertCan(actor.role, "worker:updateAssignedJob");
    await assertIssueScope(issue, actor);
  }

  await withTransaction(async (tx) => {
    for (let i = 0; i < input.imageKeys.length; i++) {
      await tx.insert(issueImages).values({
        id: uuid(),
        issueId: issue.id,
        url: fileKeyToUrl(input.imageKeys[i]!),
        type: "PROGRESS",
        caption: "Progress update",
        sortOrder: 100 + i,
        uploadedById: actor.id,
      });
    }
    await addEvent(tx, issue.id, "PROGRESS_UPDATE", `Progress update: ${input.message.slice(0, 300)}`, {
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { images: input.imageKeys.length },
    });
  });

  const recipientIds = [...(await followerIds(issue.id)), ...(issue.createdById ? [issue.createdById] : [])];
  await notifyMany(recipientIds, {
    type: "STATUS_CHANGED",
    title: `Work update on ${issue.publicId}`,
    message: input.message.slice(0, 180),
    link: `/issues/${issue.publicId}`,
    issueId: issue.id,
  });
  await recordAudit(
    { id: actor.id, email: actor.email },
    "ISSUE_PROGRESS_UPDATE",
    "ISSUE",
    issue.id,
    { message: input.message.slice(0, 200), images: input.imageKeys.length }
  );
}

export async function reopenIssue(
  publicId: string,
  actor: CurrentUser,
  input: { reason: string; imageKeys?: string[] }
) {
  const db = await getDb();
  const { issue } = await loadIssue(publicId);
  const isReporter = issue.createdById === actor.id;
  if (!isReporter) {
    assertCan(actor.role, "issue:reopenAny");
    await assertIssueScope(issue, actor);
  }
  if (!["RESOLVED", "CLOSED"].includes(issue.status)) {
    throw new ActionError("Only resolved or closed complaints can be reopened.");
  }
  if (isReporter && !can(actor.role, "issue:reopenOwn")) {
    throw new ForbiddenError();
  }

  await withTransaction(async (tx) => {
    for (let i = 0; i < (input.imageKeys?.length ?? 0); i++) {
      await tx.insert(issueImages).values({
        id: uuid(),
        issueId: issue.id,
        url: fileKeyToUrl(input.imageKeys![i]!),
        type: "OTHER",
        caption: "Reopen evidence",
        sortOrder: 300 + i,
        uploadedById: actor.id,
      });
    }
    await tx
      .update(issues)
      .set({
        reopenCount: sql`${issues.reopenCount} + 1`,
        reopenedFromId: issue.id,
        resolvedAt: null,
        closedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issue.id));
  });

  await transitionStatus(issue.id, {
    to: "REOPENED",
    actor,
    reason: input.reason,
    eventMessage: `Reopened by ${isReporter ? "the reporter" : actor.name}: "${input.reason.slice(0, 200)}"`,
  });

  // Fresh SLA clock for the reopened issue.
  const [cat, slaDefaults] = await Promise.all([
    db.select().from(categories).where(eq(categories.id, issue.categoryId)).limit(1),
    getSlaDefaults(),
  ]);
  const deadline = computeSlaDeadline(new Date(), issue.priority, cat[0], slaDefaults);
  await db.update(issues).set({ slaDeadline: deadline, isOverdue: false }).where(eq(issues.id, issue.id));
}

export async function closeIssue(publicId: string, actor: CurrentUser, note?: string) {
  assertCan(actor.role, "issue:updateStatus");
  const { issue } = await loadIssue(publicId);
  await assertIssueScope(issue, actor);
  await transitionStatus(issue.id, {
    to: "CLOSED",
    actor,
    note: note ?? null,
    eventMessage: note ? `Closed — ${note}` : "Issue closed",
  });
}

/** Merge a duplicate into a canonical issue (spec §141). */
export async function mergeIssues(
  duplicatePublicId: string,
  canonicalPublicId: string,
  actor: CurrentUser
) {
  assertCan(actor.role, "issue:merge");
  const dup = await loadIssue(duplicatePublicId);
  const canonical = await loadIssue(canonicalPublicId);
  await Promise.all([assertIssueScope(dup.issue, actor), assertIssueScope(canonical.issue, actor)]);
  if (actor.role === "AUTHORITY" && dup.issue.departmentId !== canonical.issue.departmentId) {
    throw new ForbiddenError("Department staff can only merge complaints within their department.");
  }
  if (dup.issue.id === canonical.issue.id) {
    throw new ActionError("An issue cannot be merged into itself.");
  }
  await withTransaction(async (tx) => {
    await tx
      .update(issues)
      .set({
        isDuplicate: true,
        duplicateOfId: canonical.issue.id,
        mergedIntoId: canonical.issue.id,
        status: "CLOSED",
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(issues.id, dup.issue.id));
    await tx.insert(issueStatusHistory).values({
      id: uuid(),
      issueId: dup.issue.id,
      fromStatus: dup.issue.status,
      toStatus: "CLOSED",
      changedById: actor.id,
      reason: `Merged into ${canonical.issue.publicId}`,
    });
    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId: dup.issue.id,
      type: "MERGED",
      actorId: actor.id,
      actorRole: actor.role,
      message: `Merged into ${canonical.issue.publicId}`,
      isPublic: true,
    });
    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId: canonical.issue.id,
      type: "MERGE_RECEIVED",
      actorId: actor.id,
      actorRole: actor.role,
      message: `Duplicate report ${dup.issue.publicId} merged into this issue`,
      isPublic: true,
    });
    // Carry supporters across.
    await tx
      .update(issues)
      .set({ upvotesCount: sql`${issues.upvotesCount} + ${dup.issue.upvotesCount}` })
      .where(eq(issues.id, canonical.issue.id));
  });
  await notify({
    userId: dup.issue.createdById,
    type: "STATUS_CHANGED",
    title: `Your report ${dup.issue.publicId} was merged`,
    message: `It duplicates ${canonical.issue.publicId}. All updates will continue there.`,
    issueId: canonical.issue.id,
    link: `/issues/${canonical.issue.publicId}`,
    email: true,
  });
  await recordAudit(
    { id: actor.id, email: actor.email },
    "ISSUE_MERGED",
    "ISSUE",
    dup.issue.id,
    { into: canonical.issue.publicId }
  );
}

// ---------------------------------------------------------------------------
// Community actions (upvote / follow / confirm / comment / feedback)
// ---------------------------------------------------------------------------

export async function toggleUpvote(publicId: string, actor: CurrentUser): Promise<{ upvoted: boolean; count: number }> {
  assertCan(actor.role, "upvote:create");
  const db = await getDb();
  const { issue } = await loadIssue(publicId);
  const existing = await db
    .select({ id: upvotes.id })
    .from(upvotes)
    .where(and(eq(upvotes.issueId, issue.id), eq(upvotes.userId, actor.id)))
    .limit(1);
  let upvoted = false;
  await withTransaction(async (tx) => {
    if (existing[0]) {
      await tx.delete(upvotes).where(eq(upvotes.id, existing[0].id));
      await tx.update(issues).set({ upvotesCount: sql`max(0, ${issues.upvotesCount} - 1)`, updatedAt: new Date() }).where(eq(issues.id, issue.id));
      upvoted = false;
    } else {
      await tx.insert(upvotes).values({ id: uuid(), issueId: issue.id, userId: actor.id });
      await tx.update(issues).set({ upvotesCount: sql`${issues.upvotesCount} + 1`, updatedAt: new Date() }).where(eq(issues.id, issue.id));
      await tx.update(users).set({ trustScore: sql`${users.trustScore} + 1` }).where(eq(users.id, actor.id));
      upvoted = true;
    }
  });
  await recomputePriority(issue.id);
  const rows = await db.select({ n: issues.upvotesCount }).from(issues).where(eq(issues.id, issue.id)).limit(1);
  return { upvoted, count: rows[0]?.n ?? 0 };
}

export async function toggleFollow(publicId: string, actor: CurrentUser): Promise<{ following: boolean }> {
  const db = await getDb();
  const { issue } = await loadIssue(publicId);
  const existing = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.issueId, issue.id), eq(follows.userId, actor.id)))
    .limit(1);
  if (existing[0]) {
    await db.delete(follows).where(eq(follows.id, existing[0].id));
    return { following: false };
  }
  await db.insert(follows).values({ id: uuid(), issueId: issue.id, userId: actor.id });
  return { following: true };
}

export async function confirmIssue(publicId: string, actor: CurrentUser, note?: string): Promise<{ count: number }> {
  assertCan(actor.role, "confirm:create");
  const db = await getDb();
  const { issue } = await loadIssue(publicId);
  if (issue.createdById === actor.id) {
    throw new ActionError("You reported this issue — you can't also confirm it.");
  }
  const existing = await db
    .select({ id: confirmations.id })
    .from(confirmations)
    .where(and(eq(confirmations.issueId, issue.id), eq(confirmations.userId, actor.id)))
    .limit(1);
  if (existing[0]) throw new ActionError("You've already confirmed this issue.");
  await withTransaction(async (tx) => {
    await tx.insert(confirmations).values({ id: uuid(), issueId: issue.id, userId: actor.id, note: note ?? null });
    await tx.update(issues).set({ confirmationsCount: sql`${issues.confirmationsCount} + 1`, updatedAt: new Date() }).where(eq(issues.id, issue.id));
    await tx.update(users).set({ trustScore: sql`${users.trustScore} + 5` }).where(eq(users.id, actor.id));
    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId: issue.id,
      type: "COMMUNITY_CONFIRMED",
      actorId: actor.id,
      actorRole: actor.role,
      message: `${actor.name} confirmed this issue exists on the ground`,
      isPublic: true,
    });
  });
  await recomputePriority(issue.id);
  const rows = await db.select({ n: issues.confirmationsCount }).from(issues).where(eq(issues.id, issue.id)).limit(1);
  return { count: rows[0]?.n ?? 0 };
}

export async function addComment(publicId: string, actor: CurrentUser, content: string): Promise<{ id: string }> {
  assertCan(actor.role, "comment:create");
  const { issue } = await loadIssue(publicId);
  if (actor.role !== "CITIZEN") await assertIssueScope(issue, actor);
  const id = uuid();
  await withTransaction(async (tx) => {
    await tx.insert(comments).values({ id, issueId: issue.id, userId: actor.id, content });
    await tx.update(issues).set({ commentsCount: sql`${issues.commentsCount} + 1`, updatedAt: new Date() }).where(eq(issues.id, issue.id));
    await tx.update(users).set({ trustScore: sql`${users.trustScore} + 2` }).where(eq(users.id, actor.id));
    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId: issue.id,
      type: "COMMENT",
      actorId: actor.id,
      actorRole: actor.role,
      message: `${actor.name} commented`,
      isPublic: false,
    });
  });
  // Notify the reporter (and followers for staff comments) about replies.
  if (issue.createdById !== actor.id) {
    await notify({
      userId: issue.createdById,
      type: "COMMENT_REPLY",
      title: `New comment on ${issue.publicId}`,
      message: content.slice(0, 140),
      issueId: issue.id,
      link: `/issues/${issue.publicId}`,
    });
  }
  if (actor.role !== "CITIZEN") {
    const followers = await followerIds(issue.id);
    await notifyMany(followers.filter((f) => f !== actor.id && f !== issue.createdById), {
      type: "COMMENT_REPLY",
      title: `Authority update on ${issue.publicId}`,
      message: content.slice(0, 140),
      issueId: issue.id,
      link: `/issues/${issue.publicId}`,
    });
  }
  return { id };
}

export async function moderateComment(
  commentId: string,
  actor: CurrentUser,
  action: "hide" | "restore" | "delete",
  reason?: string
) {
  assertCan(actor.role, "comment:moderate");
  const db = await getDb();
  const rows = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  const comment = rows[0];
  if (!comment) throw new ActionError("Comment not found.", 404);
  const { issue } = await loadIssue(comment.issueId);
  await assertIssueScope(issue, actor);
  if (action === "delete") {
    await withTransaction(async (tx) => {
      await tx.delete(comments).where(eq(comments.id, commentId));
      await tx.update(issues).set({ commentsCount: sql`max(0, ${issues.commentsCount} - 1)` }).where(eq(issues.id, comment.issueId));
    });
  } else {
    await db
      .update(comments)
      .set({ isHidden: action === "hide", hiddenReason: action === "hide" ? reason ?? null : null, updatedAt: new Date() })
      .where(eq(comments.id, commentId));
  }
  await recordAudit(
    { id: actor.id, email: actor.email },
    `COMMENT_${action.toUpperCase()}`,
    "COMMENT",
    commentId,
    { issueId: comment.issueId, reason: reason ?? null }
  );
}

export async function submitFeedback(
  publicId: string,
  actor: CurrentUser,
  input: { rating: number; resolutionStatus: "YES" | "PARTIALLY" | "NO"; comment?: string }
) {
  assertCan(actor.role, "feedback:create");
  const db = await getDb();
  const { issue } = await loadIssue(publicId);
  if (issue.createdById !== actor.id) {
    throw new ForbiddenError("Only the reporter can give feedback on this complaint.");
  }
  if (!["RESOLVED", "CLOSED"].includes(issue.status)) {
    throw new ActionError("Feedback can be given after the issue is resolved.");
  }
  await db.insert(feedback).values({
    id: uuid(),
    issueId: issue.id,
    userId: actor.id,
    rating: input.rating,
    resolutionStatus: input.resolutionStatus,
    comment: input.comment || null,
  });
  await withTransaction(async (tx) => {
    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId: issue.id,
      type: "FEEDBACK",
      actorId: actor.id,
      actorRole: actor.role,
      message: `Reporter rated the resolution ${input.rating}/5 (${
        input.resolutionStatus === "YES" ? "resolved" : input.resolutionStatus === "PARTIALLY" ? "partially resolved" : "not resolved"
      })`,
      isPublic: true,
    });
    await tx.update(users).set({ trustScore: sql`${users.trustScore} + 3` }).where(eq(users.id, actor.id));
  });
  await recordAudit({ id: actor.id, email: actor.email }, "FEEDBACK_SUBMITTED", "ISSUE", issue.id, {
    rating: input.rating,
  });
}

// ---------------------------------------------------------------------------
// Priority recomputation & SLA sweep
// ---------------------------------------------------------------------------

export async function recomputePriority(issueId: string): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({ issue: issues, slug: categories.slug })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .where(eq(issues.id, issueId))
    .limit(1);
  const row = rows[0];
  if (!row) return;
  const { issue, slug } = row;
  const weights = await getPriorityWeights();
  const result = computePriority({
    severity: issue.severity,
    categorySlug: slug,
    title: issue.title,
    description: issue.description,
    upvotes: issue.upvotesCount,
    confirmations: issue.confirmationsCount,
    weights,
  });
  const patch: Record<string, unknown> = {
    priorityScore: result.score,
    priorityExplanation: result.explanation,
    updatedAt: new Date(),
  };
  if (result.priority !== issue.priority) {
    patch.priority = result.priority;
    const [cat, slaDefaults] = await Promise.all([
      db.select().from(categories).where(eq(categories.id, issue.categoryId)).limit(1),
      getSlaDefaults(),
    ]);
    if (OPEN_STATUSES.includes(issue.status)) {
      patch.slaDeadline = computeSlaDeadline(issue.createdAt, result.priority, cat[0], slaDefaults);
    }
    await db.insert(issueEvents).values({
      id: uuid(),
      issueId,
      type: "PRIORITY_CHANGED",
      actorId: null,
      actorRole: "SYSTEM",
      message: `Priority recalculated: ${issue.priority} → ${result.priority} (score ${result.score}/100)`,
      isPublic: true,
    });
  }
  await db.update(issues).set(patch).where(eq(issues.id, issueId));
}

/**
 * Lazy SLA sweep (spec §45): marks open issues past deadline as overdue and
 * auto-escalates those exceeding the deadline by >25%. Called on dashboard
 * loads — no external cron needed. Idempotent and cheap (indexed query).
 */
export async function sweepOverdue(): Promise<{ marked: number; escalated: number }> {
  const db = await getDb();
  const now = Date.now();
  const open = await db
    .select()
    .from(issues)
    .where(
      and(
        inArray(issues.status, ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_INFORMATION", "REOPENED"]),
        sql`${issues.slaDeadline} IS NOT NULL`
      )
    );
  let marked = 0;
  let escalated = 0;
  for (const issue of open) {
    if (!issue.slaDeadline) continue;
    const overdue = isOverdue(issue.slaDeadline, new Date(now));
    if (overdue && !issue.isOverdue) {
      await db.update(issues).set({ isOverdue: true, updatedAt: new Date(now) }).where(eq(issues.id, issue.id));
      marked++;
    }
    // Auto-escalate when 25% past the SLA window (min 1h grace).
    const deadlineMs = issue.slaDeadline.getTime();
    const slaWindowMs = Math.max(3600_000, deadlineMs - issue.createdAt.getTime());
    const escalateAt = deadlineMs + Math.max(3600_000, slaWindowMs * 0.25);
    if (
      now > escalateAt &&
      ["ASSIGNED", "IN_PROGRESS", "VERIFIED"].includes(issue.status) &&
      canTransition(issue.status, "ESCALATED")
    ) {
      await transitionStatus(issue.id, {
        to: "ESCALATED",
        actor: SYSTEM_ACTOR,
        reason: "SLA deadline exceeded",
        eventMessage: "Automatically escalated — SLA deadline exceeded",
      });
      escalated++;
    }
  }
  return { marked, escalated };
}

/** Priority adjustment by authority (manual override with explanation). */
export async function setPriority(
  publicId: string,
  actor: CurrentUser,
  priority: Priority,
  reason: string
) {
  assertCan(actor.role, "issue:updateStatus");
  const db = await getDb();
  const { issue } = await loadIssue(publicId);
  await assertIssueScope(issue, actor);
  if (!reason || reason.trim().length < 5) {
    throw new ActionError("Please explain why the priority is being changed.");
  }
  const score = { LOW: 15, MEDIUM: 40, HIGH: 65, CRITICAL: 90 }[priority];
  const [cat, slaDefaults] = await Promise.all([
    db.select().from(categories).where(eq(categories.id, issue.categoryId)).limit(1),
    getSlaDefaults(),
  ]);
  await withTransaction(async (tx) => {
    await tx
      .update(issues)
      .set({
        priority,
        priorityScore: score,
        priorityExplanation: `Manually set by ${actor.name}: ${reason}`,
        slaDeadline: OPEN_STATUSES.includes(issue.status)
          ? computeSlaDeadline(new Date(), priority, cat[0], slaDefaults)
          : issue.slaDeadline,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issue.id));
    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId: issue.id,
      type: "PRIORITY_OVERRIDE",
      actorId: actor.id,
      actorRole: actor.role,
      message: `Priority changed ${issue.priority} → ${priority}: ${reason}`,
      isPublic: true,
    });
  });
  await recordAudit({ id: actor.id, email: actor.email }, "PRIORITY_CHANGED", "ISSUE", issue.id, {
    from: issue.priority,
    to: priority,
    reason,
  });
}

export async function getIssueByIdOrPublicId(idOrPublicId: string) {
  return loadIssue(idOrPublicId);
}
