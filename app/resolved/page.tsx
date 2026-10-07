import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { CheckCircle2, Image as ImageIcon, MapPin } from "lucide-react";
import { getDb } from "@/lib/db";
import { issueImages, issues } from "@/drizzle/sqlite/schema";
import { listIssues } from "@/lib/queries/issues";
import { getActiveCategories } from "@/lib/queries/references";
import { listIssuesQuerySchema } from "@/lib/validation";
import { BeforeAfterSlider } from "@/components/issues/gallery";
import { StatusBadge } from "@/components/issues/status-badge";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { IssuesPagination } from "@/components/issues/issues-browser";
import { ResolvedFilters } from "@/components/issues/resolved-filters";
import { formatDate, timeAgo } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Resolved reports",
  description: "See verified civic fixes, resolution evidence and before-and-after photos from the community.",
};
export const dynamic = "force-dynamic";

type StoryPhotos = { before?: string; after?: string; fallback?: string };

export default async function ResolvedPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const parsed = listIssuesQuerySchema.safeParse(flat);
  const base = parsed.success ? parsed.data : listIssuesQuerySchema.parse({});
  const requestedStatus: "RESOLVED" | "CLOSED" | undefined = flat.status === "RESOLVED" || flat.status === "CLOSED" ? flat.status as "RESOLVED" | "CLOSED" : undefined;
  const query = { ...base, status: requestedStatus, statuses: requestedStatus ? undefined : "RESOLVED,CLOSED", pageSize: 12 };

  const [result, categories] = await Promise.all([
    listIssues({ query, scope: "public" }),
    getActiveCategories(),
  ]);
  const ids = result.items.map((item) => item.id);
  let photoByIssue = new Map<string, StoryPhotos>();
  if (ids.length) {
    const db = await getDb();
    const rows = await db.select({ issueId: issueImages.issueId, url: issueImages.url, type: issueImages.type, sortOrder: issueImages.sortOrder })
      .from(issueImages)
      .innerJoin(issues, eq(issueImages.issueId, issues.id))
      .where(and(inArray(issueImages.issueId, ids), isNotNull(issues.resolvedAt)))
      .orderBy(asc(issueImages.sortOrder));
    photoByIssue = new Map();
    for (const row of rows) {
      const photos = photoByIssue.get(row.issueId) ?? {};
      if (row.type === "BEFORE" && !photos.before) photos.before = row.url;
      if (row.type === "AFTER" && !photos.after) photos.after = row.url;
      if (!photos.fallback) photos.fallback = row.url;
      photoByIssue.set(row.issueId, photos);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-verdant"><CheckCircle2 className="h-4 w-4" aria-hidden /> Work completed</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Resolved in the community</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">Real reports, real fixes. Browse resolution evidence and compare before-and-after photos when available.</p>
        </div>
        <ButtonLink href="/report" variant="outline">Report an issue</ButtonLink>
      </header>

      <Suspense fallback={<div className="skeleton h-12 rounded-xl" />}>
        <ResolvedFilters categories={categories.map((category) => ({ slug: category.slug, name: category.name }))} />
      </Suspense>

      {result.items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<ImageIcon className="h-6 w-6" aria-hidden />}
          title="No resolved reports found"
          message="Try another search or category. Resolved reports and their evidence will appear here as issues are completed."
          action={<ButtonLink href="/issues" variant="secondary">Browse open reports</ButtonLink>}
        />
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between text-xs text-ink-muted" aria-live="polite">
            <span>{result.total.toLocaleString("en-IN")} completed report{result.total === 1 ? "" : "s"}</span>
            <span>Resolution dates are based on the published issue timeline.</span>
          </div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((issue) => {
              const photos = photoByIssue.get(issue.id) ?? {};
              return (
                <article key={issue.id} className="group overflow-hidden rounded-card border border-line bg-surface shadow-card">
                    <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
                      {photos.before && photos.after ? (
                        <BeforeAfterSlider before={photos.before} after={photos.after} />
                      ) : photos.fallback ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photos.fallback} alt="Resolution evidence" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-ink-muted"><ImageIcon className="h-8 w-8" aria-hidden /><span className="sr-only">No photos attached</span></div>
                      )}
                      <div className="absolute left-3 top-3"><StatusBadge status={issue.status} /></div>
                    </div>
                    <div className="space-y-2.5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-ink-muted">{issue.publicId}</span>
                        <PriorityBadge priority={issue.priority} />
                      </div>
                      <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink"><Link href={`/issues/${issue.publicId}`} className="hover:text-terra-700 hover:underline">{issue.title}</Link></h2>
                      <p className="text-xs text-ink-soft">{issue.category}</p>
                      <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-ink-muted">
                        <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{issue.locality ?? issue.city ?? "Location withheld"}</span></span>
                        <span className="shrink-0" title={formatDate(issue.resolvedAt)}>{timeAgo(issue.resolvedAt)}</span>
                      </div>
                    </div>
                </article>
              );
            })}
          </div>
          <div className="mt-8"><Suspense><IssuesPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} /></Suspense></div>
        </>
      )}
    </div>
  );
}
