import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ClipboardList, SearchX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { count, desc, eq } from "drizzle-orm";
import { drafts, issues } from "@/drizzle/sqlite/schema";
import { listIssues } from "@/lib/queries/issues";
import { getActiveCategories } from "@/lib/queries/references";
import { listIssuesQuerySchema } from "@/lib/validation";
import { IssueCard } from "@/components/issues/issue-card";
import { IssuesFilters, IssuesPagination } from "@/components/issues/issues-browser";
import { DraftList, ExportMyReports, MyReportsTabs, type DraftSummary } from "@/components/issues/my-reports-tools";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My reports",
  description: "Track every civic report you've submitted, from review to resolution.",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const BUCKETS = {
  all: [] as string[],
  review: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "WAITING_FOR_INFORMATION"],
  progress: ["ASSIGNED", "IN_PROGRESS", "REOPENED", "ESCALATED"],
  resolved: ["RESOLVED", "CLOSED"],
  rejected: ["REJECTED"],
};

export default async function MyReportsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/my-reports");
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const parsed = listIssuesQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listIssuesQuerySchema.parse({});

  const db = await getDb();
  const [result, categories, statusCounts, draftRows] = await Promise.all([
    listIssues({ query, viewer: user, scope: "mine" }),
    getActiveCategories(),
    db.select({ status: issues.status, n: count() })
      .from(issues)
      .where(eq(issues.createdById, user.id))
      .groupBy(issues.status),
    db.select({ id: drafts.id, payload: drafts.payload, updatedAt: drafts.updatedAt })
      .from(drafts)
      .where(eq(drafts.userId, user.id))
      .orderBy(desc(drafts.updatedAt))
      .limit(10),
  ]);

  const byStatus = new Map(statusCounts.map((row) => [row.status, row.n]));
  const counts = Object.fromEntries(Object.entries(BUCKETS).map(([key, statuses]) => [
    key,
    statuses.length ? statuses.reduce((sum, status) => sum + (byStatus.get(status as never) ?? 0), 0) : statusCounts.reduce((sum, row) => sum + row.n, 0),
  ])) as Record<keyof typeof BUCKETS, number>;

  const savedDrafts: DraftSummary[] = draftRows.map((draft) => {
    let title = "";
    try {
      const payload = JSON.parse(draft.payload) as { state?: { title?: unknown } };
      if (typeof payload.state?.title === "string") title = payload.state.title;
    } catch { /* Keep a generic draft title if saved JSON is corrupt. */ }
    return { id: draft.id, title, updatedAt: draft.updatedAt };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">My reports</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Follow each report through review, field work and resolution.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMyReports />
          <ButtonLink href="/report">+ New report</ButtonLink>
        </div>
      </header>

      {savedDrafts.length > 0 && (
        <section className="mt-7" aria-labelledby="draft-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="draft-heading" className="text-sm font-bold text-ink">Unfinished drafts</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Saved reports are private to your account.</p>
            </div>
            <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber-accent">{savedDrafts.length} saved</span>
          </div>
          <DraftList drafts={savedDrafts} />
        </section>
      )}

      <section className="mt-8" aria-label="Filter your reports">
        <Suspense fallback={<div className="skeleton h-10 w-full rounded-xl" />}>
          <MyReportsTabs counts={counts} />
          <div className="mt-3">
            <IssuesFilters categories={categories.map((category) => ({ slug: category.slug, name: category.name, icon: category.icon }))} />
          </div>
        </Suspense>
      </section>

      <div className="mt-5 flex items-center justify-between text-xs text-ink-muted" aria-live="polite">
        <span>{result.total.toLocaleString("en-IN")} report{result.total === 1 ? "" : "s"} match your view</span>
        <span>Sorted by {query.sort === "newest" ? "newest" : query.sort}</span>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={query.q || query.status || query.statuses ? <SearchX className="h-6 w-6" aria-hidden /> : <ClipboardList className="h-6 w-6" aria-hidden />}
          title={query.q || query.status || query.statuses ? "No reports match these filters" : "You haven't submitted a report yet"}
          message={query.q || query.status || query.statuses ? "Try clearing a filter or searching for a different complaint." : "When you spot a pothole, broken streetlight or other civic issue, start your first report here."}
          action={<ButtonLink href="/report">Report an issue</ButtonLink>}
        />
      ) : (
        <>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
          </div>
          <div className="mt-8">
            <Suspense>
              <IssuesPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}
