/**
 * Centralized role-based access control (spec §123).
 *
 * The matrix below is the ONLY place permission rules are declared; API
 * routes and server components call `can()` / `requirePermission()` so the
 * frontend and backend can never disagree.
 */
import type { UserRole } from "@/lib/types";

export type Permission =
  | "issue:create"
  | "issue:viewPublic"
  | "issue:editOwn"
  | "issue:editAny"
  | "issue:viewPrivate" // see exact locations, internal notes, reporter contact
  | "issue:verify"
  | "issue:reject"
  | "issue:requestInfo"
  | "issue:assign"
  | "issue:changeDepartment"
  | "issue:updateStatus"
  | "issue:resolve"
  | "issue:reopenOwn"
  | "issue:reopenAny"
  | "issue:escalate"
  | "issue:merge"
  | "issue:delete"
  | "comment:create"
  | "comment:moderate"
  | "upvote:create"
  | "confirm:create"
  | "feedback:create"
  | "abuse:report"
  | "abuse:review"
  | "worker:viewOwnJobs"
  | "worker:updateAssignedJob"
  | "authority:viewDepartmentQueue"
  | "analytics:viewDepartment"
  | "analytics:viewPlatform"
  | "users:manage"
  | "departments:manage"
  | "categories:manage"
  | "settings:manage"
  | "audit:view"
  | "audit:viewDepartment"
  | "export:department"
  | "export:platform";

const MATRIX: Record<UserRole, Set<Permission>> = {
  CITIZEN: new Set<Permission>([
    "issue:create",
    "issue:viewPublic",
    "issue:editOwn",
    "issue:reopenOwn",
    "comment:create",
    "upvote:create",
    "confirm:create",
    "feedback:create",
    "abuse:report",
  ]),
  AUTHORITY: new Set<Permission>([
    "issue:create",
    "issue:viewPublic",
    "issue:viewPrivate",
    "issue:editOwn",
    "issue:verify",
    "issue:reject",
    "issue:requestInfo",
    "issue:assign",
    "issue:changeDepartment",
    "issue:updateStatus",
    "issue:resolve",
    "issue:reopenAny",
    "issue:escalate",
    "issue:merge",
    "comment:create",
    "comment:moderate",
    "upvote:create",
    "confirm:create",
    "feedback:create",
    "abuse:report",
    "abuse:review",
    "authority:viewDepartmentQueue",
    "analytics:viewDepartment",
    "audit:viewDepartment",
    "export:department",
  ]),
  WORKER: new Set<Permission>([
    "issue:create",
    "issue:viewPublic",
    "issue:viewPrivate",
    "worker:viewOwnJobs",
    "worker:updateAssignedJob",
    "issue:resolve",
    "issue:updateStatus",
    "comment:create",
    "abuse:report",
  ]),
  ADMIN: new Set<Permission>([
    "issue:create",
    "issue:viewPublic",
    "issue:viewPrivate",
    "issue:editOwn",
    "issue:editAny",
    "issue:verify",
    "issue:reject",
    "issue:requestInfo",
    "issue:assign",
    "issue:changeDepartment",
    "issue:updateStatus",
    "issue:resolve",
    "issue:reopenOwn",
    "issue:reopenAny",
    "issue:escalate",
    "issue:merge",
    "issue:delete",
    "comment:create",
    "comment:moderate",
    "upvote:create",
    "confirm:create",
    "feedback:create",
    "abuse:report",
    "abuse:review",
    "authority:viewDepartmentQueue",
    "analytics:viewDepartment",
    "analytics:viewPlatform",
    "users:manage",
    "departments:manage",
    "categories:manage",
    "settings:manage",
    "audit:view",
    "export:department",
    "export:platform",
    "worker:viewOwnJobs",
    "worker:updateAssignedJob",
  ]),
};

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[role]?.has(permission) ?? false;
}

export function permissionsFor(role: UserRole): Permission[] {
  return [...(MATRIX[role] ?? [])];
}

/** Department scope is never platform-wide for department staff. */
export function hasDepartmentScope(
  actorDepartmentId: string | null | undefined,
  resourceDepartmentId: string | null | undefined
): boolean {
  return !!actorDepartmentId && !!resourceDepartmentId && actorDepartmentId === resourceDepartmentId;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError();
}
