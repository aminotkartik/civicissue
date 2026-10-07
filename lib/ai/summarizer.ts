/**
 * AI Features 5 & 6 — Issue summaries and admin operational insights.
 * Both degrade to deterministic template-based text when no LLM is set.
 */
import {
  getChatProvider,
  logAiFailure,
  type IssueContext,
} from "@/lib/ai/provider";
import { timeAgo } from "@/lib/utils/format";

export interface SummaryResult {
  summary: string;
  provider: string;
  isFallback: boolean;
}

export async function summarizeIssue(ctx: IssueContext): Promise<SummaryResult> {
  const provider = getChatProvider();
  if (provider) {
    try {
      const timelineText = ctx.timeline
        .slice(-12)
        .map((e) => `- ${e.createdAt.toISOString().slice(0, 10)}: ${e.message}`)
        .join("\n");
      const summary = await provider.chat([
        {
          role: "system",
          content:
            "Summarize a civic complaint's full history for authority staff in 2-3 factual sentences. Do not invent facts. Plain text only.",
        },
        {
          role: "user",
          content: `Complaint ${ctx.publicId}: ${ctx.title}\nCategory: ${ctx.categoryName}\nStatus: ${ctx.status}, Priority: ${ctx.priority}\nArea: ${ctx.locality ?? "unknown"}\nSupporters: ${ctx.upvotes}\nDescription: ${ctx.description.slice(0, 500)}\nTimeline:\n${timelineText}`,
        },
      ]);
      return { summary: summary.trim().slice(0, 600), provider: provider.name, isFallback: false };
    } catch (err) {
      logAiFailure("summarizeIssue", err);
    }
  }
  return {
    summary: buildFallbackSummary(ctx),
    provider: "local-template",
    isFallback: true,
  };
}

function buildFallbackSummary(ctx: IssueContext): string {
  const parts: string[] = [];
  parts.push(
    `${ctx.categoryName} complaint "${ctx.title}" reported ${timeAgo(ctx.timeline[0]?.createdAt ?? new Date())} in ${ctx.locality ?? "an unknown area"}.`
  );
  const verified = ctx.timeline.find((e) => /verif/i.test(e.message));
  const assigned = ctx.timeline.find((e) => /assign/i.test(e.message));
  const progress = ctx.timeline.find((e) => /started|progress/i.test(e.message));
  const resolved = ctx.timeline.find((e) => /resolv/i.test(e.message));
  if (verified) parts.push("Verified by the authority.");
  if (assigned) parts.push("Assigned to the responsible team.");
  if (progress) parts.push("Work has started.");
  if (resolved) parts.push("Marked resolved.");
  if (!verified && !assigned) parts.push(`Current status: ${ctx.status}.`);
  if (ctx.upvotes > 0) parts.push(`${ctx.upvotes} citizens support this report.`);
  return parts.join(" ");
}

export async function generateAdminInsights(statsJson: string): Promise<SummaryResult> {
  const provider = getChatProvider();
  if (provider) {
    try {
      const insights = await provider.chat([
        {
          role: "system",
          content:
            "You are an analyst for a civic issue platform. From the provided JSON statistics, write 3-5 short operational insights (trend changes, hotspots, SLA risks). Use only the given numbers, never invent any. Plain bullet lines.",
        },
        { role: "user", content: statsJson },
      ]);
      return { summary: insights.trim().slice(0, 1500), provider: provider.name, isFallback: false };
    } catch (err) {
      logAiFailure("adminInsights", err);
    }
  }
  return { summary: buildFallbackInsights(statsJson), provider: "local-template", isFallback: true };
}

function buildFallbackInsights(statsJson: string): string {
  try {
    const stats = JSON.parse(statsJson) as {
      topCategory?: { name: string; count: number };
      overdue?: number;
      critical?: number;
      resolutionRate?: number;
      topZone?: { name: string; count: number };
      reopenedRate?: number;
    };
    const lines: string[] = [];
    if (stats.topCategory)
      lines.push(
        `• ${stats.topCategory.name} is the most reported category with ${stats.topCategory.count} complaints.`
      );
    if (stats.topZone)
      lines.push(`• ${stats.topZone.name} is the densest zone (${stats.topZone.count} complaints) — inspect for recurring infrastructure causes.`);
    if (typeof stats.overdue === "number" && stats.overdue > 0)
      lines.push(`• ${stats.overdue} complaints are past their SLA deadline and need escalation review.`);
    if (typeof stats.critical === "number" && stats.critical > 0)
      lines.push(`• ${stats.critical} critical-priority complaints are currently open.`);
    if (typeof stats.resolutionRate === "number")
      lines.push(`• Overall resolution rate stands at ${Math.round(stats.resolutionRate * 100)}%.`);
    if (typeof stats.reopenedRate === "number" && stats.reopenedRate > 0.1)
      lines.push(`• Reopen rate of ${Math.round(stats.reopenedRate * 100)}% suggests resolution quality needs attention.`);
    return lines.join("\n") || "Not enough data for deterministic insights.";
  } catch {
    return "Insights unavailable.";
  }
}
