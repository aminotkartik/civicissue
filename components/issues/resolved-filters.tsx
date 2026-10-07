"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";

export function ResolvedFilters({ categories }: { categories: { slug: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const status = params.get("status");

  const update = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const existing = params.get("q") ?? "";
      if (existing !== search.trim()) update("q", search.trim() || null);
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search, params, update]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center">
      <Tabs
        value={status === "RESOLVED" || status === "CLOSED" ? status : "ALL"}
        items={[
          { key: "ALL", label: "All resolved" },
          { key: "RESOLVED", label: "Resolved" },
          { key: "CLOSED", label: "Closed" },
        ]}
        onChange={(key) => update("status", key === "ALL" ? null : key)}
        className="w-fit"
      />
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search resolved reports</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search resolved reports…"
          className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm focus:border-terra-400 focus:outline-none focus:ring-2 focus:ring-terra-200"
        />
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
        Category
        <Select value={params.get("category") ?? ""} onChange={(event) => update("category", event.target.value || null)} className="min-w-40 text-sm" aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
        </Select>
      </label>
    </div>
  );
}
