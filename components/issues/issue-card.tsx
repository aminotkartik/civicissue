import Link from "next/link";
import { MapPin, MessageCircle, ThumbsUp } from "lucide-react";
import { StatusBadge } from "@/components/issues/status-badge";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { timeAgo } from "@/lib/utils/format";
import type { IssueCardData } from "@/lib/types";
import { cn } from "@/lib/utils/format";

/**
 * The canonical issue card (spec §71): photo, title, category, priority,
 * location, status, supporters, freshness. Links to /issues/[publicId].
 */
export function IssueCard({ issue, className }: { issue: IssueCardData; className?: string }) {
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-card border border-line bg-surface shadow-card transition-shadow hover:shadow-pop",
        className
      )}
    >
      <Link href={`/issues/${issue.publicId}`} className="block focus-visible:outline-none">
        <div className="relative h-40 w-full overflow-hidden bg-surface-2">
          {issue.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={issue.coverImage}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-line">
              <MapPin className="h-8 w-8 text-ink-muted/50" aria-hidden />
            </div>
          )}
          <div className="absolute left-2.5 top-2.5">
            <StatusBadge status={issue.status} className="bg-surface/95 shadow-sm" />
          </div>
          {issue.distanceKm !== undefined && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-semibold text-white">
              {issue.distanceKm < 1 ? `${Math.round(issue.distanceKm * 1000)} m` : `${issue.distanceKm.toFixed(1)} km`} away
            </span>
          )}
        </div>
        <div className="space-y-2.5 p-4">
          <p className="font-mono text-[11px] tracking-wide text-ink-muted">{issue.publicId}</p>
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink group-hover:text-terra-700">
            {issue.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
              {issue.category}
            </span>
            <PriorityBadge priority={issue.priority} />
          </div>
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {issue.locality ?? issue.city ?? "Location approximate"}
              {issue.locationPrivacy === "APPROXIMATE" && " (approx.)"}
            </span>
          </p>
          <div className="flex items-center justify-between border-t border-line pt-2.5 text-xs text-ink-muted">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1" title={`${issue.upvotesCount} supporters`}>
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> {issue.upvotesCount}
              </span>
              <span className="flex items-center gap-1" title={`${issue.commentsCount} comments`}>
                <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {issue.commentsCount}
              </span>
            </span>
            <span>Updated {timeAgo(issue.updatedAt)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
