import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { listIssues } from "@/lib/queries/issues";
import { listIssuesQuerySchema } from "@/lib/validation";
import { fail, handleError } from "@/lib/api/respond";
import { can } from "@/lib/permissions/matrix";
import { getDb } from "@/lib/db";
import { users } from "@/drizzle/sqlite/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/export?format=csv|json&...listIssues filters
 * Authorization: staff export their department (or everything for admins);
 * citizens may only export their own reports.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const format = url.searchParams.get("format") === "json" ? "json" : "csv";
    const raw = Object.fromEntries(url.searchParams.entries());
    const query = listIssuesQuerySchema.parse({ ...raw, pageSize: 50, page: 1 });

    let scope: "public" | "mine" | "staff" = "mine";
    let departmentId: string | null = null;
    if (can(user.role, "export:platform")) {
      scope = "staff";
    } else if (can(user.role, "export:department")) {
      scope = "staff";
      const db = await getDb();
      const rows = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, user.id)).limit(1);
      departmentId = rows[0]?.departmentId ?? null;
      if (!departmentId) return fail(403, "Your account is not assigned to a department.");
    }

    // Collect up to 1000 rows respecting the same filters.
    const all: Awaited<ReturnType<typeof listIssues>>["items"] = [];
    for (let page = 1; page <= 20; page++) {
      const result = await listIssues({
        query: { ...query, page, pageSize: 50 },
        viewer: user,
        scope,
        departmentId,
      });
      all.push(...result.items);
      if (all.length >= result.total) break;
    }

    const filename = `civicissue-export-${new Date().toISOString().slice(0, 10)}`;
    if (format === "json") {
      return new Response(JSON.stringify(all, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }
    const headers = [
      "Complaint ID", "Title", "Category", "Status", "Priority", "Priority Score",
      "Locality", "City", "Latitude", "Longitude", "Supporters", "Department",
      "Created", "Updated", "Resolved",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.map(esc).join(",")];
    for (const i of all) {
      lines.push([
        i.publicId, i.title, i.category, i.status, i.priority, i.priorityScore,
        i.locality, i.city, i.latitude, i.longitude, i.upvotesCount, i.departmentName,
        i.createdAt.toISOString(), i.updatedAt.toISOString(), i.resolvedAt?.toISOString() ?? "",
      ].map(esc).join(","));
    }
    return new Response("\ufeff" + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
