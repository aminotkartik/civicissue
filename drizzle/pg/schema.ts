/**
 * CivicIssue — PostgreSQL production schema.
 *
 * Mirrors `drizzle/sqlite/schema.ts` (the canonical development schema) with
 * PostgreSQL column types. Table names, column names, relations, indexes and
 * JavaScript-level types (Date, number, boolean) are identical, so all
 * application queries are dialect-neutral.
 *
 * Production setup:
 *   DATABASE_URL=postgres://... npx drizzle-kit push
 */
import {
  pgTable,
  text,
  integer,
  bigint,
  doublePrecision,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { mode: "date" }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Users & authentication
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    role: text("role", {
      enum: ["CITIZEN", "AUTHORITY", "WORKER", "ADMIN"],
    })
      .notNull()
      .default("CITIZEN"),
    phone: text("phone"),
    city: text("city"),
    locality: text("locality"),
    profileImage: text("profile_image"),
    bio: text("bio"),
    isActive: boolean("is_active").notNull().default(true),
    isSuspended: boolean("is_suspended").notNull().default(false),
    suspensionReason: text("suspension_reason"),
    trustScore: integer("trust_score").notNull().default(0),
    googleId: text("google_id"),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    prefEmail: boolean("pref_email").notNull().default(true),
    prefInApp: boolean("pref_in_app").notNull().default(true),
    prefStatusUpdates: boolean("pref_status_updates").notNull().default(true),
    prefResolution: boolean("pref_resolution").notNull().default(true),
    prefCommunity: boolean("pref_community").notNull().default(false),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const passwordResets = pgTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: ts("created_at"),
});

// ---------------------------------------------------------------------------
// Organizational structure
// ---------------------------------------------------------------------------

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  zones: text("zones"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const workers = pgTable("workers", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  employeeId: text("employee_id").notNull(),
  departmentId: text("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "restrict" }),
  zone: text("zone"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("cone"),
  defaultDepartmentId: text("default_department_id").references(
    () => departments.id,
    { onDelete: "set null" }
  ),
  slaCriticalHours: integer("sla_critical_hours").notNull().default(24),
  slaHighHours: integer("sla_high_hours").notNull().default(48),
  slaMediumHours: integer("sla_medium_hours").notNull().default(120),
  slaLowHours: integer("sla_low_hours").notNull().default(240),
  defaultPriority: text("default_priority", {
    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  })
    .notNull()
    .default("MEDIUM"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export const issues = pgTable(
  "issues",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "VERIFIED",
        "REJECTED",
        "ASSIGNED",
        "IN_PROGRESS",
        "WAITING_FOR_INFORMATION",
        "RESOLVED",
        "CLOSED",
        "REOPENED",
        "ESCALATED",
      ],
    })
      .notNull()
      .default("SUBMITTED"),
    severity: text("severity", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    })
      .notNull()
      .default("MEDIUM"),
    priority: text("priority", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    })
      .notNull()
      .default("MEDIUM"),
    priorityScore: integer("priority_score").notNull().default(0),
    priorityExplanation: text("priority_explanation"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    locality: text("locality"),
    zone: text("zone"),
    locationPrivacy: text("location_privacy", {
      enum: ["EXACT", "APPROXIMATE"],
    })
      .notNull()
      .default("EXACT"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    assignedWorkerId: text("assigned_worker_id").references(() => workers.id, {
      onDelete: "set null",
    }),
    isPublic: boolean("is_public").notNull().default(true),
    isHidden: boolean("is_hidden").notNull().default(false),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    duplicateOfId: text("duplicate_of_id"),
    mergedIntoId: text("merged_into_id"),
    reopenedFromId: text("reopened_from_id"),
    aiCategory: text("ai_category"),
    aiConfidence: doublePrecision("ai_confidence"),
    aiSeverity: text("ai_severity"),
    aiSummary: text("ai_summary"),
    aiObservations: text("ai_observations"),
    aiProvider: text("ai_provider"),
    slaDeadline: timestamp("sla_deadline", { mode: "date" }),
    isOverdue: boolean("is_overdue").notNull().default(false),
    verificationRequestedInfo: text("verification_requested_info"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    closedAt: timestamp("closed_at", { mode: "date" }),
    reopenCount: integer("reopen_count").notNull().default(0),
    upvotesCount: integer("upvotes_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    confirmationsCount: integer("confirmations_count").notNull().default(0),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    uniqueIndex("issues_public_id_idx").on(t.publicId),
    index("issues_status_idx").on(t.status),
    index("issues_category_idx").on(t.categoryId),
    index("issues_created_at_idx").on(t.createdAt),
    index("issues_department_idx").on(t.departmentId),
    index("issues_worker_idx").on(t.assignedWorkerId),
    index("issues_creator_idx").on(t.createdById),
    index("issues_locality_idx").on(t.locality),
    index("issues_location_idx").on(t.latitude, t.longitude),
    index("issues_priority_idx").on(t.priority),
  ]
);

export const issueImages = pgTable(
  "issue_images",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    thumbUrl: text("thumb_url"),
    type: text("type", {
      enum: ["BEFORE", "PROGRESS", "AFTER", "OTHER"],
    })
      .notNull()
      .default("BEFORE"),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    uploadedById: text("uploaded_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: ts("created_at"),
  },
  (t) => [index("issue_images_issue_idx").on(t.issueId)]
);

export const issueStatusHistory = pgTable(
  "issue_status_history",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedById: text("changed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    createdAt: ts("created_at"),
  },
  (t) => [index("issue_status_history_issue_idx").on(t.issueId)]
);

export const issueEvents = pgTable(
  "issue_events",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role"),
    message: text("message").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    metadata: text("metadata"),
    createdAt: ts("created_at"),
  },
  (t) => [index("issue_events_issue_idx").on(t.issueId)]
);

// ---------------------------------------------------------------------------
// Community interaction
// ---------------------------------------------------------------------------

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isHidden: boolean("is_hidden").notNull().default(false),
    hiddenReason: text("hidden_reason"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("comments_issue_idx").on(t.issueId)]
);

export const upvotes = pgTable(
  "upvotes",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("upvotes_issue_user_idx").on(t.issueId, t.userId)]
);

export const follows = pgTable(
  "follows",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("follows_issue_user_idx").on(t.issueId, t.userId)]
);

export const confirmations = pgTable(
  "confirmations",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("confirmations_issue_user_idx").on(t.issueId, t.userId)]
);

export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    resolutionStatus: text("resolution_status", {
      enum: ["YES", "PARTIALLY", "NO"],
    }).notNull(),
    comment: text("comment"),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("feedback_issue_user_idx").on(t.issueId, t.userId),
    index("feedback_issue_idx").on(t.issueId),
  ]
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    issueId: text("issue_id").references(() => issues.id, {
      onDelete: "cascade",
    }),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    metadata: text("metadata"),
    createdAt: ts("created_at"),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.isRead),
    index("notifications_created_idx").on(t.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Moderation, audit & platform
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata"),
    ip: text("ip"),
    createdAt: ts("created_at"),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
  ]
);

export const abuseReports = pgTable("abuse_reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  entityType: text("entity_type", { enum: ["ISSUE", "COMMENT", "USER"] })
    .notNull(),
  entityId: text("entity_id").notNull(),
  reasonType: text("reason_type", {
    enum: ["SPAM", "OFFENSIVE", "FALSE_INFO", "PII", "FRAUD", "OTHER"],
  }).notNull(),
  details: text("details"),
  status: text("status", {
    enum: ["PENDING", "REVIEWED", "DISMISSED"],
  })
    .notNull()
    .default("PENDING"),
  reviewedById: text("reviewed_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewNote: text("review_note"),
  createdAt: ts("created_at"),
});

export const drafts = pgTable("drafts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: ts("updated_at"),
});

// Silence unused-import lint for bigint (kept for future large counters).
void bigint;
