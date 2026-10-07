import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listIssues } from "@/lib/queries/issues";
import { getActiveCategories } from "@/lib/queries/references";
import { listIssuesQuerySchema } from "@/lib/validation";
import { IssueCard } from "@/components/issues/issue-card";
import { IssuesFilters, IssuesPagination } from "@/components/issues/issues-browser";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { sweepOverdue } from "@/lib/queries/issue-actions";

export const metadata: Metadata = {
  title: "Explore civic issues",
  description: "Browse, search and filter public civic issue reports — potholes, streetlights, garbage, water and more.",
};

export const dynamic = "force-dynamic";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v;
  }
  const parsed = listIssuesQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listIssuesQuerySchema.parse({});
  const viewer = await getCurrentUser();
  const categories = await getActiveCategories();

  // Keep overdue/escalation state fresh (lazy sweep — no cron needed).
  sweepOverdue().catch(() => {});

  const result = await listIssues({ query, viewer, scope: "public" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Explore civic issues</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {result.total.toLocaleString("en-IN")} public reports — search by keyword, complaint ID,
          area or pincode. Support the ones that matter to you.
        </p>
      </header>

      <Suspense fallback={<div className="skeleton h-11 w-full rounded-lg" />}>
        <IssuesFilters
          categories={categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }))}
        />
      </Suspense>

      {result.items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<SearchX className="h-6 w-6" />}
          title={
            query.q
              ? `No civic issues found matching “${query.q}”`
              : "No issues match these filters"
          }
          message={
            query.q
              ? "Try a different keyword, widen your filters — or be the first to report this problem in your area."
              : "Try removing some filters to see more reports."
          }
          action={<ButtonLink href="/report">Report this issue</ButtonLink>}
        />
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
          <div className="mt-8">
            <Suspense>
              <IssuesPagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
              />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}
