import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/api/respond";
import {
  getPlatformStats,
  getTimeSeries,
  getByCategory,
  getByLocality,
  getByStatus,
  getByPriority,
  getDepartmentWorkload,
  getSatisfaction,
  getZoneHeatmap,
  detectHotspots,
} from "@/lib/queries/analytics";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail(403, "Admins only.");
    const [stats, timeSeries, byCategory, byLocality, byStatus, byPriority, workload, satisfaction, heatmap, hotspots] =
      await Promise.all([
        getPlatformStats(),
        getTimeSeries(30),
        getByCategory(),
        getByLocality(10),
        getByStatus(),
        getByPriority(),
        getDepartmentWorkload(),
        getSatisfaction(),
        getZoneHeatmap(),
        detectHotspots(7, 4),
      ]);
    return ok({ stats, timeSeries, byCategory, byLocality, byStatus, byPriority, workload, satisfaction, heatmap, hotspots });
  } catch (err) {
    return handleError(err);
  }
}
