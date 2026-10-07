import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCheck,
  Clock,
  FileWarning,
  HardHat,
  MapPin,
  MessageSquareQuote,
  Sparkles,
  Star,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { hasDepartmentScope } from "@/lib/permissions/matrix";
import { getIssueDetail, publicCoordinates } from "@/lib/queries/issues";
import { getActiveDepartments, getWorkersWithLoad, getWorkerByUserId } from "@/lib/queries/references";
import { slaStatusText } from "@/lib/sla/engine";
import { STATUS_LABELS } from "@/lib/status/machine";
import { formatDateTime, timeAgo, cn } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CategoryIcon } from "@/components/ui/category-icon";
import { StatusBadge } from "@/components/issues/status-badge";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { LifecycleBar } from "@/components/issues/lifecycle";
import { ImageGallery, BeforeAfterSlider } from "@/components/issues/gallery";
import { Timeline, type TimelineItem } from "@/components/issues/timeline";
import { CommentsSection } from "@/components/issues/comments-section";
import { FeedbackForm, ReopenButton } from "@/components/issues/feedback-form";
import { IssueInteractions } from "@/components/issues/issue-interactions";
import { StaffPanel } from "@/components/issues/staff-panel";
import { WorkerActions } from "@/components/issues/worker-actions";
import { IssueMap } from "@/components/issues/issue-map";
import { IssueLive } from "@/components/issues/issue-live";
import { ProvideInfoForm } from "@/components/issues/provide-info-form";
import type { IssueStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const EVENT_TONES: Record<string, TimelineItem["tone"]> = {
  VERIFIED: "success",
  RESOLVED: "success",
  CLOSED: "success",
  ASSIGNED: "default",
  IN_PROGRESS: "default",
  REJECTED: "danger",
  ESCALATED: "warning",
  REOPENED: "warning",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const detail = await getIssueDetail(id, viewer);
  if (!detail) return { title: "Complaint not found · CivicIssue" };
  const { issue } = detail;
  const indexable = issue.isPublic && !issue.isHidden && !["DRAFT", "REJECTED"].includes(issue.status);
  return {
    title: `${issue.title} (${issue.publicId})`,
    description: `${STATUS_LABELS[issue.status]} · ${issue.locality ?? issue.city ?? ""} — follow this civic complaint and its resolution on CivicIssue.`,
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      title: `${issue.title} · ${issue.publicId}`,
      description: issue.description.slice(0, 160),
      type: "article",
    },
  };
}

export default async function IssueDetailPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const detail = await getIssueDetail(id, viewer);
  if (!detail) notFound();

  const { issue, category, department, worker, reporter, images, events, commentsList, feedbackList, viewerState, duplicateOf } = detail;

  // Merged duplicates redirect to the canonical complaint (spec §141).
  if (duplicateOf?.publicId && duplicateOf.publicId !== issue.publicId) {
    redirect(`/issues/${duplicateOf.publicId}`);
  }

  const coords = publicCoordinates(issue);
  const sla = slaStatusText(issue.slaDeadline, issue.resolvedAt);

  // Staff access is resource-scoped: authorities see their department, workers their own jobs.
  let viewerWorkerId: string | null = null;
  if (viewer?.role === "WORKER") {
    const w = await getWorkerByUserId(viewer.id);
    viewerWorkerId = w?.worker.id ?? null;
  }
  const isAssignedWorker = viewerWorkerId !== null && issue.assignedWorkerId === viewerWorkerId;
  const isStaff = !!viewer && (
    viewer.role === "ADMIN" ||
    (viewer.role === "AUTHORITY" && hasDepartmentScope(viewer.departmentId, issue.departmentId)) ||
    (viewer.role === "WORKER" && isAssignedWorker)
  );

  // Staff reference data (loaded only for authorized authority/admin viewers).
  const [departments, workers] = isStaff && viewer && ["AUTHORITY", "ADMIN"].includes(viewer.role)
    ? await Promise.all([getActiveDepartments(), getWorkersWithLoad()])
    : [[], []];

  const visibleEvents = events.filter((e) => e.isPublic || isStaff);
  const timelineItems: TimelineItem[] = visibleEvents.map((e) => ({
    id: e.id,
    message: e.message,
    timestamp: e.createdAt,
    done: true,
    actorName: e.actorName,
    actorRole: e.actorRole,
    tone: EVENT_TONES[e.type] ?? "default",
  }));

  // Rejection reason lives in the status history / timeline (single source of truth).
  const rejectionNote =
    [...detail.statusHistory].reverse().find((h) => h.toStatus === "REJECTED")?.reason ??
    visibleEvents.find((e) => e.type === "REJECTED")?.message ??
    null;

  const before = images.find((i) => i.type === "BEFORE");
  const after = images.find((i) => i.type === "AFTER");

  const latestFeedback = feedbackList[0];
  const showFeedbackForm =
    viewerState.isReporter &&
    ["RESOLVED", "CLOSED"].includes(issue.status) &&
    !viewerState.hasFeedback;
  const showReopen =
    viewerState.isReporter && ["RESOLVED", "CLOSED"].includes(issue.status);

  const visibleComments = commentsList.filter((c) => !c.isHidden || isStaff);
  const aiObservations: string[] = (() => {
    try {
      const parsed = issue.aiObservations ? JSON.parse(issue.aiObservations) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  })();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <IssueLive
        publicId={issue.publicId}
        initialUpdatedAt={issue.updatedAt.getTime()}
        enabled={!["CLOSED", "REJECTED"].includes(issue.status)}
      />

      {/* ------------------------------------------------------------ header */}
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-ink-muted">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/issues" className="hover:text-terra-600 hover:underline">All complaints</Link></li>
          <li aria-hidden>/</li>
          <li className="font-mono font-semibold text-ink-soft">{issue.publicId}</li>
        </ol>
      </nav>

      <header className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} score={issue.priorityScore} />
          {issue.isOverdue && !issue.resolvedAt && (
            <Badge tone="negative" dot>Overdue</Badge>
          )}
          {issue.reopenCount > 0 && (
            <Badge tone="warning">Reopened ×{issue.reopenCount}</Badge>
          )}
          {duplicateOf && (
            <Badge tone="neutral">Merged into {duplicateOf.publicId}</Badge>
          )}
        </div>
        <h1 className="mt-3 text-xl font-bold leading-snug text-ink sm:text-2xl">
          {issue.title}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink-soft">
            <CategoryIcon name={category.icon} className="h-4 w-4 text-terra-600" />
            {category.name}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {[
              issue.locationPrivacy === "EXACT" || viewerState.canSeeExact ? issue.address : null,
              issue.locality,
              issue.city,
            ].filter(Boolean).join(", ")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Reported {timeAgo(issue.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
            {issue.upvotesCount} supporting
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            {issue.confirmationsCount} confirmed
          </span>
        </div>

        {issue.status === "DRAFT" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-accent/35 bg-amber-soft/60 px-4 py-3">
            <p className="text-[13px] font-medium text-ink-soft">
              This is an unsent draft — it isn&apos;t visible to the authority yet.
            </p>
            <ButtonLink href="/report" variant="secondary" size="sm">Continue draft</ButtonLink>
          </div>
        )}
        {issue.status === "REJECTED" && rejectionNote && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-alert/30 bg-alert-soft/60 px-4 py-3">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden />
            <p className="text-[13px] leading-relaxed text-ink-soft">
              <strong className="text-ink">Rejected:</strong> {rejectionNote}
            </p>
          </div>
        )}
        {issue.status === "WAITING_FOR_INFORMATION" && issue.verificationRequestedInfo && viewerState.isReporter && (
          <div className="mt-4">
            <ProvideInfoForm publicId={issue.publicId} request={issue.verificationRequestedInfo} />
          </div>
        )}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* -------------------------------------------------------- main column */}
        <div className="space-y-6 lg:col-span-2">
          <LifecycleBar status={issue.status} />

          {/* Evidence */}
          {images.length > 0 && (
            <section aria-labelledby="evidence-heading" className="rounded-xl border border-line bg-surface p-5">
              <h2 id="evidence-heading" className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                Evidence ({images.length})
              </h2>
              {before && after && (
                <div className="mt-3.5">
                  <BeforeAfterSlider before={before.url} after={after.url} />
                </div>
              )}
              <ImageGallery
                className="mt-4"
                images={images.map((i) => ({
                  url: i.url,
                  type: i.type,
                  caption: i.caption,
                }))}
              />
            </section>
          )}

          {/* Description */}
          <section aria-labelledby="description-heading" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="description-heading" className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              Description
            </h2>
            <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {issue.description}
            </p>

            {aiObservations.length > 0 && (
              <div className="mt-4 rounded-lg border border-active/25 bg-active-soft/50 p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-active">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {issue.aiProvider === "fallback" ? "Automated image observations" : "AI-assisted analysis"} · advisory only
                </p>
                <ul className="mt-2 space-y-1">
                  {aiObservations.map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-active" aria-hidden />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Priority transparency */}
          <section aria-labelledby="priority-heading" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="priority-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
              <AlertTriangle className="h-4 w-4" aria-hidden /> How priority is decided
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-terra-50 text-lg font-bold text-terra-700 ring-2 ring-terra-200" aria-label={`Priority score ${issue.priorityScore} out of 100`}>
                {issue.priorityScore}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{issue.priority} priority · severity reported as {issue.severity.toLowerCase()}</p>
                <p className="text-xs text-ink-muted">
                  Score combines severity, community support, location risk, safety impact, age and infrastructure type.
                </p>
              </div>
            </div>
            {issue.priorityExplanation && (
              <p className="mt-3 rounded-lg bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                {issue.priorityExplanation}
              </p>
            )}
          </section>

          {/* Map */}
          <section aria-labelledby="map-heading" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="map-heading" className="text-sm font-bold uppercase tracking-wide text-ink-muted">Location</h2>
            <IssueMap
              className="mt-3"
              latitude={coords.latitude}
              longitude={coords.longitude}
              status={issue.status}
              title={issue.title}
              categoryIcon={category.icon}
              publicId={issue.publicId}
              obscured={coords.obscured}
            />
            <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
              {[
                ["Locality", issue.locality],
                ["Zone", issue.zone],
                ["City", issue.city],
                ["Pincode", issue.pincode],
                ["State", issue.state],
                ["Privacy", coords.obscured ? "Approximate" : "Exact"],
              ].map(([label, value]) =>
                value ? (
                  <div key={label}>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</dt>
                    <dd className="font-medium text-ink-soft">{value}</dd>
                  </div>
                ) : null
              )}
            </dl>
          </section>

          {/* Timeline */}
          <section aria-labelledby="timeline-heading" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="timeline-heading" className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              Progress timeline
            </h2>
            <Timeline className="mt-4" items={timelineItems} />
          </section>

          {/* Feedback */}
          {showFeedbackForm && <FeedbackForm publicId={issue.publicId} />}
          {latestFeedback && (
            <section aria-labelledby="feedback-heading" className="rounded-xl border border-line bg-surface p-5">
              <h2 id="feedback-heading" className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                Citizen feedback
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1" aria-label={`Rated ${latestFeedback.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn("h-4.5 w-4.5", s <= latestFeedback.rating ? "fill-amber-accent text-amber-accent" : "text-line-strong")}
                      aria-hidden
                    />
                  ))}
                </span>
                <Badge
                  tone={
                    latestFeedback.resolutionStatus === "YES"
                      ? "success"
                      : latestFeedback.resolutionStatus === "PARTIALLY"
                        ? "warning"
                        : "negative"
                  }
                >
                  {latestFeedback.resolutionStatus === "YES"
                    ? "Confirmed resolved"
                    : latestFeedback.resolutionStatus === "PARTIALLY"
                      ? "Partially resolved"
                      : "Not resolved"}
                </Badge>
                {latestFeedback.userName && (
                  <span className="text-xs text-ink-muted">by {latestFeedback.userName} · {timeAgo(latestFeedback.createdAt)}</span>
                )}
              </div>
              {latestFeedback.comment && (
                <p className="mt-2.5 flex items-start gap-2 rounded-lg bg-surface-2 px-4 py-3 text-[13px] italic leading-relaxed text-ink-soft">
                  <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                  {latestFeedback.comment}
                </p>
              )}
            </section>
          )}
          {showReopen && !showFeedbackForm && (
            <div className="max-w-sm">
              <ReopenButton publicId={issue.publicId} isReporter={viewerState.isReporter} />
            </div>
          )}

          {/* Comments */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <CommentsSection
              publicId={issue.publicId}
              comments={visibleComments.map((c) => ({
                id: c.id,
                content: c.content,
                createdAt: c.createdAt,
                isHidden: c.isHidden,
                user: c.user,
              }))}
              isLoggedIn={!!viewer}
              canModerate={isStaff && !!viewer && ["AUTHORITY", "ADMIN"].includes(viewer.role)}
            />
          </div>
        </div>

        {/* -------------------------------------------------------- side column */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="sr-only">Community actions</h2>
            <IssueInteractions
              publicId={issue.publicId}
              title={issue.title}
              isLoggedIn={!!viewer}
              isReporter={viewerState.isReporter}
              viewerRole={viewer?.role ?? null}
              initial={{
                upvoted: viewerState.upvoted,
                following: viewerState.following,
                confirmed: viewerState.confirmed,
                upvotes: issue.upvotesCount,
                confirmations: issue.confirmationsCount,
              }}
            />
            {showReopen && showFeedbackForm && (
              <div className="mt-3">
                <ReopenButton publicId={issue.publicId} isReporter />
              </div>
            )}
          </div>

          {/* Responsibility */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Responsibility</h2>
            <dl className="mt-3 space-y-3 text-[13px]">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-terra-600" aria-hidden />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Department</dt>
                  <dd className="font-semibold text-ink">{department?.name ?? <span className="font-normal text-ink-muted">Not yet assigned</span>}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-amber-accent" aria-hidden />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Field worker</dt>
                  <dd className="font-semibold text-ink">
                    {worker ? (
                      <>
                        {worker.name}{" "}
                        <span className="font-mono text-[11px] font-normal text-ink-muted">#{worker.employeeId}</span>
                        {worker.zone && <span className="block text-[11px] font-normal text-ink-muted">{worker.zone} zone</span>}
                      </>
                    ) : (
                      <span className="font-normal text-ink-muted">Not yet assigned</span>
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarClock className={cn("mt-0.5 h-4 w-4 shrink-0", sla.tone === "overdue" ? "text-alert" : sla.tone === "soon" ? "text-amber-accent" : "text-verdant")} aria-hidden />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Resolution SLA</dt>
                  <dd className={cn("font-semibold", sla.tone === "overdue" ? "text-alert" : sla.tone === "soon" ? "text-amber-accent" : "text-ink")}>
                    {sla.text}
                  </dd>
                  {issue.slaDeadline && !issue.resolvedAt && (
                    <dd className="text-[11px] text-ink-muted">Deadline {formatDateTime(issue.slaDeadline)}</dd>
                  )}
                </div>
              </div>
              {issue.resolvedAt && (
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Resolved</dt>
                  <dd className="font-medium text-ink-soft">{formatDateTime(issue.resolvedAt)} ({timeAgo(issue.resolvedAt)})</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Reporter */}
          {reporter && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Reported by</h2>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={reporter.name} role="CITIZEN" size="md" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <UserRound className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                    {viewerState.isReporter ? "You" : reporter.name}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    Member since {formatDateTime(reporter.createdAt).split(",")[0]}
                  </p>
                </div>
              </div>
              <p className="mt-2.5 rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
                Contribution score <strong className="text-ink-soft">{reporter.trustScore}</strong> — earned by
                helpful, verified reports. It never punishes citizens.
              </p>
            </div>
          )}

          {/* Staff / worker panels */}
          {isStaff && viewer && ["AUTHORITY", "ADMIN"].includes(viewer.role) && (
            <StaffPanel
              publicId={issue.publicId}
              status={issue.status as IssueStatus}
              priority={issue.priority}
              role={viewer.role as "AUTHORITY" | "ADMIN"}
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              workers={workers.map((w) => ({
                id: w.id,
                name: w.name,
                employeeId: w.employeeId,
                departmentId: w.departmentId,
                assigned: w.assigned,
                inProgress: w.inProgress,
                overdue: w.overdue,
              }))}
              currentDepartmentId={issue.departmentId}
              currentWorkerId={issue.assignedWorkerId}
            />
          )}
          {isAssignedWorker && (
            <WorkerActions publicId={issue.publicId} status={issue.status as IssueStatus} priority={issue.priority} />
          )}
        </aside>
      </div>
    </main>
  );
}
