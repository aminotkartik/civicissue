/**
 * Centralized Zod validation schemas (spec §57).
 * Every API route parses its input through these schemas — client-side
 * validation is UX only and never trusted.
 */
import { z } from "zod";
import {
  ISSUE_STATUSES,
  PRIORITY_LEVELS,
  REJECTION_REASONS,
  ABUSE_REASON_TYPES,
  IMAGE_TYPES,
  LOCATION_PRIVACY,
  USER_ROLES,
} from "@/lib/types";

export const publicIdSchema = z.string().regex(/^CIV-\d{4}-\d{6}$/, {
  message: "Complaint ID must look like CIV-2026-000123.",
});

export const coordinateSchema = z.object({
  latitude: z
    .number({ message: "Latitude must be a number." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  longitude: z
    .number({ message: "Longitude must be a number." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
});

export const createIssueSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(8, "Title must contain at least 8 characters.")
      .max(120, "Title must be under 120 characters."),
    description: z
      .string()
      .trim()
      .min(20, "Description must contain at least 20 characters so the authority understands the problem.")
      .max(3000, "Description must be under 3000 characters."),
    categorySlug: z.string().trim().min(1, "Please choose a category."),
    severity: z.enum(PRIORITY_LEVELS, {
      errorMap: () => ({ message: "Please choose a valid severity level." }),
    }),
    ...coordinateSchema.shape,
    address: z.string().trim().max(300).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    state: z.string().trim().max(120).optional().nullable(),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{5,6}$/, "Pincode must be 5–6 digits.")
      .optional()
      .or(z.literal(""))
      .nullable(),
    locality: z.string().trim().max(160).optional().nullable(),
    zone: z.string().trim().max(80).optional().nullable(),
    locationPrivacy: z.enum(LOCATION_PRIVACY).default("EXACT"),
    isPublic: z.boolean().default(true),
    /** image keys already uploaded via /api/uploads */
    imageKeys: z.array(z.string().trim().min(1)).max(8, "You can attach up to 8 images.").default([]),
    /** advisory AI context from the wizard */
    aiCategory: z.string().trim().max(60).optional().nullable(),
    aiConfidence: z.number().min(0).max(1).optional().nullable(),
    aiSeverity: z.enum(PRIORITY_LEVELS).optional().nullable(),
    aiObservations: z.array(z.string()).max(8).optional().nullable(),
  })
  .strict();

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(2, "Comment cannot be empty.")
    .max(1000, "Comment must be under 1000 characters."),
});

export const rejectSchema = z.object({
  reason: z.enum(REJECTION_REASONS, {
    errorMap: () => ({ message: "Please choose a rejection reason." }),
  }),
  note: z.string().trim().max(500).optional().default(""),
});

export const assignSchema = z.object({
  // IDs are server-generated (uuid() in production, readable keys in seed
  // data), so only presence/length is validated here.
  departmentId: z.string().trim().min(1).max(64).optional().nullable(),
  workerId: z.string().trim().min(1).max(64).optional().nullable(),
  note: z.string().trim().max(500).optional().default(""),
});

export const statusSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
  note: z.string().trim().max(500).optional().default(""),
});

export const resolveSchema = z.object({
  description: z
    .string()
    .trim()
    .min(15, "Please describe the resolution (at least 15 characters).")
    .max(1500),
  /** AFTER image keys — required unless severity is LOW */
  imageKeys: z.array(z.string().trim().min(1)).max(6).default([]),
  resolvedDate: z.string().optional().nullable(),
});

export const reopenSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(15, "Please explain why the issue needs reopening (at least 15 characters).")
    .max(800),
  imageKeys: z.array(z.string().trim().min(1)).max(4).default([]),
});

export const requestInfoSchema = z.object({
  message: z
    .string()
    .trim()
    .min(15, "Tell the citizen exactly what information is needed (at least 15 characters).")
    .max(800),
});

export const provideInfoSchema = z.object({
  message: z.string().trim().min(10).max(1500),
  imageKeys: z.array(z.string().trim().min(1)).max(4).default([]),
});

export const feedbackSchema = z.object({
  rating: z
    .number({ message: "Please rate the resolution." })
    .int()
    .min(1, "Rating must be between 1 and 5.")
    .max(5, "Rating must be between 1 and 5."),
  resolutionStatus: z.enum(["YES", "PARTIALLY", "NO"], {
    errorMap: () => ({ message: "Please tell us whether the issue was resolved." }),
  }),
  comment: z.string().trim().max(1000).optional().default(""),
});

export const abuseReportSchema = z.object({
  entityType: z.enum(["ISSUE", "COMMENT", "USER"]),
  entityId: z.string().min(1),
  reasonType: z.enum(ABUSE_REASON_TYPES),
  details: z.string().trim().max(1000).optional().default(""),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(120),
    email: z.string().trim().email("Enter a valid email address.").max(200),
    password: z
      .string()
      .min(8, "Password must contain at least 8 characters.")
      .max(200)
      .regex(/[A-Z]/, "Password must include one uppercase letter.")
      .regex(/[a-z]/, "Password must include one lowercase letter.")
      .regex(/[0-9]/, "Password must include one number."),
    confirmPassword: z.string(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{7,16}$/, "Enter a valid phone number.")
      .optional()
      .or(z.literal(""))
      .nullable(),
    city: z.string().trim().min(2, "Enter your city.").max(120),
    locality: z.string().trim().max(160).optional().default(""),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid or expired reset link."),
  password: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .regex(/[A-Z]/, "Password must include one uppercase letter.")
    .regex(/[a-z]/, "Password must include one lowercase letter.")
    .regex(/[0-9]/, "Password must include one number.")
    .max(200),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  locality: z.string().trim().max(160).nullable().optional(),
  bio: z.string().trim().max(400).nullable().optional(),
  profileImage: z.string().trim().max(500).nullable().optional(),
  prefEmail: z.boolean().optional(),
  prefInApp: z.boolean().optional(),
  prefStatusUpdates: z.boolean().optional(),
  prefResolution: z.boolean().optional(),
  prefCommunity: z.boolean().optional(),
});

export const listIssuesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  statuses: z.string().optional(), // comma separated
  category: z.string().trim().max(60).optional(), // slug
  priority: z.enum(PRIORITY_LEVELS).optional(),
  locality: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(6).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  range: z.enum(["today", "week", "month"]).optional(),
  departmentId: z.string().optional(),
  workerId: z.string().optional(),
  sla: z.enum(["overdue", "due-soon", "ok"]).optional(),
  sort: z.enum(["newest", "oldest", "priority", "updated", "support"]).default("newest"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  mine: z.enum(["true", "false"]).optional(),
});

export const nearbyQuerySchema = z.object({
  // Query-string params arrive as strings → coerce (unlike JSON bodies).
  latitude: z.coerce
    .number({ message: "Latitude must be a number." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  longitude: z.coerce
    .number({ message: "Longitude must be a number." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
  radiusKm: z.coerce.number().min(0.25).max(10).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const mapQuerySchema = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  maxLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLng: z.coerce.number().min(-180).max(180),
  statuses: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(PRIORITY_LEVELS).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export const imageTypeSchema = z.enum(IMAGE_TYPES);
export const roleSchema = z.enum(USER_ROLES);

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;

export function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiValidationError(result.error.issues);
  }
  return result.data;
}

export class ApiValidationError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super(issues[0]?.message ?? "Validation failed.");
    this.name = "ApiValidationError";
    this.issues = issues;
  }
}
