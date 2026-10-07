"use client";

/**
 * Client-side filter bar + pagination for issue listings (spec §28, §29, §79).
 * Filters live in the URL so pages stay shareable and server-rendered.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils/format";
import type { IssueStatus, Priority } from "@/lib/types";

const STATUS_GROUPS: { label: string; value: string }[] = [
  { label: "Any status", value: "" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Assigned", value: "ASSIGNED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Waiting for Info", value: "WAITING_FOR_INFORMATION" },
  { label: "Escalated", value: "ESCALATED" },
  { label: "Reopened", value: "REOPENED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" },
  { label: "Rejected", value: "REJECTED" },
];

const PRIORITIES: { label: string; value: string }[] = [
  { label: "Any priority", value: "" },
  { label: "● Critical", value: "CRITICAL" },
  { label: "● High", value: "HIGH" },
  { label: "● Medium", value: "MEDIUM" },
  { label: "● Low", value: "LOW" },
];

const DATE_RANGES = [
  { label: "Any time", value: "" },
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
];

const SORTS = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Highest priority", value: "priority" },
  { label: "Recently updated", value: "updated" },
  { label: "Most supported", value: "support" },
];

export interface CategoryChip {
  slug: string;
  name: string;
  icon: string;
}

export function IssuesFilters({ categories }: { categories: CategoryChip[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState(searchParams.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value) params.delete(key);
      else params.set(key, value);
      params.delete("page"); // reset pagination on filter change
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Debounced search (spec §80 — never hit the DB on every keystroke).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (debouncedQ.trim() !== current) update("q", debouncedQ.trim() || null);
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const activeCount = ["status", "priority", "category", "range", "locality", "city"].filter(
    (k) => searchParams.get(k)
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            type="search"
            value={debouncedQ}
            onChange={(e) => setDebouncedQ(e.target.value)}
            placeholder="Search by keyword, area or complaint ID (CIV-2026-000123)…"
            aria-label="Search issues"
            className="h-11 w-full rounded-lg border border-line bg-surface pl-10 pr-9 text-sm placeholder:text-ink-muted focus:border-terra-400 focus:outline-none focus:ring-2 focus:ring-terra-200"
          />
          {debouncedQ && (
            <button
              onClick={() => setDebouncedQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Select
            aria-label="Sort issues"
            className="w-44"
            value={searchParams.get("sort") ?? "newest"}
            onChange={(e) => update("sort", e.target.value === "newest" ? null : e.target.value)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <Button
            type="button"
            variant={showFilters || activeCount ? "primary" : "secondary"}
            className="shrink-0"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
        </div>
      </div>

      {/* Category chips */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by category">
        <FilterChip
          active={!searchParams.get("category")}
          onClick={() => update("category", null)}
          label="All categories"
        />
        {categories.map((c) => (
          <FilterChip
            key={c.slug}
            active={searchParams.get("category") === c.slug}
            onClick={() => update("category", searchParams.get("category") === c.slug ? null : c.slug)}
            label={c.name}
          />
        ))}
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              <Filter className="h-3 w-3" aria-hidden /> Status
            </span>
            <Select value={searchParams.get("status") ?? ""} onChange={(e) => update("status", e.target.value || null)} aria-label="Filter by status">
              {STATUS_GROUPS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Priority</span>
            <Select value={searchParams.get("priority") ?? ""} onChange={(e) => update("priority", e.target.value || null)} aria-label="Filter by priority">
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Date</span>
            <Select value={searchParams.get("range") ?? ""} onChange={(e) => update("range", e.target.value || null)} aria-label="Filter by date range">
              {DATE_RANGES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Locality</span>
            <input
              type="text"
              defaultValue={searchParams.get("locality") ?? ""}
              onBlur={(e) => update("locality", e.target.value.trim() || null)}
              onKeyDown={(e) => e.key === "Enter" && update("locality", (e.target as HTMLInputElement).value.trim() || null)}
              placeholder="e.g. Kothrud"
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-terra-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Pincode</span>
            <input
              type="text"
              inputMode="numeric"
              defaultValue={searchParams.get("pincode") ?? ""}
              onBlur={(e) => update("pincode", e.target.value.trim() || null)}
              onKeyDown={(e) => e.key === "Enter" && update("pincode", (e.target as HTMLInputElement).value.trim() || null)}
              placeholder="e.g. 411038"
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-terra-400 focus:outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-terra-600 bg-terra-600 text-white"
          : "border-line bg-surface text-ink-soft hover:border-terra-300 hover:text-terra-700"
      )}
    >
      {label}
    </button>
  );
}

export function IssuesPagination({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      total={total}
      pageSize={pageSize}
      onPage={(p) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        router.push(`${pathname}?${params.toString()}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );
}

export type { IssueStatus, Priority };
