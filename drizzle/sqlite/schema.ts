/**
 * CivicIssue — canonical database schema (SQLite dialect).
 *
 * This file is the source of truth for the relational data model used in
 * local development and demo mode. `drizzle/pg/schema.ts` mirrors it for
 * PostgreSQL production deployments (same tables, columns and constraints,
 * dialect-appropriate column types).
 *
 * Conventions:
 *  - Primary keys are UUID text generated in the application layer.
 *  - Timestamps are stored as epoch milliseconds and surfaced as Date.
 *  - Booleans are stored as integers (0/1) and surfaced as boolean.
 *  - Enums are TEXT columns validated by Zod + the status machine in lib/.
 */
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Users & authentication
// ---------------------------------------------------------------------------

export const users = sqliteTable(
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
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    isSuspended: integer("is_suspended", { mode: "boolean" })
      .notNull()
      .default(false),
    suspensionReason: text("suspension_reason"),
    trustScore: integer("trust_score").notNull().default(0),
    googleId: text("google_id"),
    /** Department scope for AUTHORITY users (null = platform-wide). */
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    // Notification preferences
    prefEmail: integer("pref_email", { mode: "boolean" }).notNull().default(true),
    prefInApp: integer("pref_in_app", { mode: "boolean" }).notNull().default(true),
    prefStatusUpdates: integer("pref_status_updates", { mode: "boolean" })
      .notNull()
      .default(true),
    prefResolution: integer("pref_resolution", { mode: "boolean" })
      .notNull()
      .default(true),
    prefCommunity: integer("pref_community", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// ---------------------------------------------------------------------------
// Organizational structure
// ---------------------------------------------------------------------------

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  zones: text("zones"), // comma-separated zone names
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const workers = sqliteTable("workers", {
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
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("cone"), // lucide icon name
  defaultDepartmentId: text("default_department_id").references(
    () => departments.id,
    { onDelete: "set null" }
  ),
  // SLA hours per priority (configurable per category — see lib/sla/engine.ts)
  slaCriticalHours: integer("sla_critical_hours").notNull().default(24),
  slaHighHours: integer("sla_high_hours").notNull().default(48),
  slaMediumHours: integer("sla_medium_hours").notNull().default(120),
  slaLowHours: integer("sla_low_hours").notNull().default(240),
  defaultPriority: text("default_priority", {
    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  })
    .notNull()
    .default("MEDIUM"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// ---------------------------------------------------------------------------
// Issues (the core entity)
// ---------------------------------------------------------------------------

export const issues = sqliteTable(
  "issues",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(), // CIV-2026-000123
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
      .default("MEDIUM"), // citizen-selected severity
    priority: text("priority", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    })
      .notNull()
      .default("MEDIUM"), // system-computed priority
    priorityScore: integer("priority_score").notNull().default(0),
    priorityExplanation: text("priority_explanation"),
    // Location
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
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
    // Ownership & responsibility
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    assignedWorkerId: text("assigned_worker_id").references(() => workers.id, {
      onDelete: "set null",
    }),
    // Visibility & duplication
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
    isDuplicate: integer("is_duplicate", { mode: "boolean" })
      .notNull()
      .default(false),
    duplicateOfId: text("duplicate_of_id"),
    mergedIntoId: text("merged_into_id"),
    reopenedFromId: text("reopened_from_id"),
    // AI assistance (always advisory, never authoritative)
    aiCategory: text("ai_category"),
    aiConfidence: real("ai_confidence"),
    aiSeverity: text("ai_severity"),
    aiSummary: text("ai_summary"),
    aiObservations: text("ai_observations"), // JSON array of strings
    aiProvider: text("ai_provider"),
    // Lifecycle metadata
    slaDeadline: integer("sla_deadline", { mode: "timestamp_ms" }),
    isOverdue: integer("is_overdue", { mode: "boolean" })
      .notNull()
      .default(false),
    verificationRequestedInfo: text("verification_requested_info"),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    reopenCount: integer("reopen_count").notNull().default(0),
    // Denormalized counters (maintained transactionally)
    upvotesCount: integer("upvotes_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    confirmationsCount: integer("confirmations_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
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

export const issueImages = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("issue_images_issue_idx").on(t.issueId)]
);

export const issueStatusHistory = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("issue_status_history_issue_idx").on(t.issueId)]
);

/**
 * Generic timeline events (spec §143). Every meaningful action on an issue
 * produces one event so timeline rendering stays generic.
 */
export const issueEvents = sqliteTable(
  "issue_events",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // SUBMITTED, AI_CATEGORIZED, VERIFIED, ...
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role"),
    message: text("message").notNull(),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("issue_events_issue_idx").on(t.issueId)]
);

// ---------------------------------------------------------------------------
// Community interaction
// ---------------------------------------------------------------------------

export const comments = sqliteTable(
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
    isHidden: integer("is_hidden", { mode: "boolean" })
      .notNull()
      .default(false),
    hiddenReason: text("hidden_reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("comments_issue_idx").on(t.issueId)]
);

export const upvotes = sqliteTable(
  "upvotes",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("upvotes_issue_user_idx").on(t.issueId, t.userId)]
);

export const follows = sqliteTable(
  "follows",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("follows_issue_user_idx").on(t.issueId, t.userId)]
);

export const confirmations = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("confirmations_issue_user_idx").on(t.issueId, t.userId),
  ]
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1..5
    resolutionStatus: text("resolution_status", {
      enum: ["YES", "PARTIALLY", "NO"],
    }).notNull(),
    comment: text("comment"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("feedback_issue_user_idx").on(t.issueId, t.userId),
    index("feedback_issue_idx").on(t.issueId),
  ]
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // ISSUE_SUBMITTED, STATUS_CHANGED, ...
    title: text("title").notNull(),
    message: text("message").notNull(),
    issueId: text("issue_id").references(() => issues.id, {
      onDelete: "cascade",
    }),
    link: text("link"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.isRead),
    index("notifications_created_idx").on(t.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Moderation, audit & platform
// ---------------------------------------------------------------------------

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(), // ISSUE_CREATED, ISSUE_VERIFIED, ...
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata"), // JSON
    ip: text("ip"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
  ]
);

export const abuseReports = sqliteTable("abuse_reports", {
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
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Saved drafts of in-progress reports (spec §146). */
export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(), // JSON snapshot of the wizard state
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Atomic sequence counters used to generate human-readable public IDs. */
export const counters = sqliteTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

/** Key/value application settings configurable by admins. */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
