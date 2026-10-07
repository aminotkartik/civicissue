"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/format";

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Compact page list: current ± 2 with first/last anchors.
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <nav className="flex flex-col sm:flex-row items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-xs text-ink-muted" aria-live="polite">
        Showing <span className="font-semibold text-ink-soft">{from}–{to}</span> of{" "}
        <span className="font-semibold text-ink-soft">{total.toLocaleString("en-IN")}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink-soft disabled:opacity-40 hover:bg-surface-2"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Previous</span>
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-xs text-ink-muted">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold",
                p === page
                  ? "bg-terra-600 text-white"
                  : "border border-line bg-surface text-ink-soft hover:bg-surface-2"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink-soft disabled:opacity-40 hover:bg-surface-2"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
