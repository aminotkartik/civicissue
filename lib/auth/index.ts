/**
 * Server-side auth helpers: current user lookup + role guards.
 * Used by server components and API route handlers.
 */
import { eq } from "drizzle-orm";
import { users } from "@/drizzle/sqlite/schema";
import { getDb } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/matrix";
import type { UserRole } from "@/lib/types";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  phone: string | null;
  city: string | null;
  locality: string | null;
  profileImage: string | null;
  isActive: boolean;
  isSuspended: boolean;
  trustScore: number;
  createdAt: Date;
};

/**
 * Returns the full user record for the current session, or null.
 * Suspended/deactivated accounts are treated as unauthenticated and their
 * session is rejected here (single enforcement point).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  return getUserFromSession(session);
}

export async function getUserFromSession(
  session: SessionPayload
): Promise<CurrentUser | null> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  const user = rows[0];
  if (!user || !user.isActive || user.isSuspended) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    phone: user.phone,
    city: user.city,
    locality: user.locality,
    profileImage: user.profileImage,
    isActive: user.isActive,
    isSuspended: user.isSuspended,
    trustScore: user.trustScore,
    createdAt: user.createdAt,
  };
}

export class UnauthorizedError extends Error {
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ForbiddenError("You don't have permission to view this page.");
  }
  return user;
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(password, hash);
}

/** Basic password policy shared by register/reset/validation. */
export function passwordIssues(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 8) problems.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) problems.push("one uppercase letter");
  if (!/[a-z]/.test(password)) problems.push("one lowercase letter");
  if (!/[0-9]/.test(password)) problems.push("one number");
  return problems;
}
