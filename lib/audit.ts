/**
 * Audit logging (spec §83). Every sensitive action produces one row.
 * Never call this with secrets, tokens, or passwords in metadata.
 */
import { getDb } from "@/lib/db";
import { auditLogs } from "@/drizzle/sqlite/schema";
import { uuid } from "@/lib/ids";

export type AuditActor = {
  id: string;
  email: string | null;
} | null;

export async function recordAudit(
  actor: AuditActor,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
  ip?: string | null
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditLogs).values({
      id: uuid(),
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip: ip ?? null,
    });
  } catch (err) {
    // Audit failures must not break the primary action, but must be visible.
    console.error(`[civicissue:audit] failed to record ${action}:`, err);
  }
}

export function requestIp(req?: Request): string | null {
  if (!req) return null;
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}
