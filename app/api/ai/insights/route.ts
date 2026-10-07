import { requireUser } from "@/lib/auth";
import { generateAdminInsights } from "@/lib/ai/summarizer";
import {
  getPlatformStats,
  getByCategory,
  getByLocality,
  getZoneHeatmap,
} from "@/lib/queries/analytics";
import { ok, fail, handleError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail(403, "Admins only.");
    const [stats, byCat, byZone, heatmap] = await Promise.all([
      getPlatformStats(),
      getByCategory(),
      getByLocality(8),
      getZoneHeatmap(),
    ]);
    const result = await generateAdminInsights(
      JSON.stringify({
        stats,
        topCategories: byCat.slice(0, 5),
        topZones: byZone.slice(0, 5),
        zones: heatmap.slice(0, 6),
        overdue: stats.overdueOpen,
        critical: stats.criticalOpen,
        resolutionRate: stats.resolutionRate,
        topCategory: byCat[0],
        topZone: heatmap[0],
      })
    );
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
