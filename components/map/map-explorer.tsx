"use client";

/**
 * City-wide issue map explorer (spec §31): Leaflet + OSM with clustering,
 * bbox-driven loading, status/category/priority filters, mobile list toggle
 * and an accessible alternative to the map.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crosshair, Layers, List, Map as MapIcon, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/issues/status-badge";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { CategoryIcon } from "@/components/ui/category-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { timeAgo, cn } from "@/lib/utils/format";
import type { MapMarkerData } from "@/components/maps/map-view";
import type { IssueStatus, Priority } from "@/lib/types";

const MapView = dynamic(() => import("@/components/maps/map-view"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-surface-2" aria-label="Loading map…" role="status" />
  ),
});

interface MapPoint {
  id: string;
  publicId: string;
  title: string;
  category: string;
  categoryIcon: string;
  status: IssueStatus;
  priority: Priority;
  latitude: number;
  longitude: number;
  locality: string | null;
  upvotesCount: number;
  createdAt: string;
}

const STATUS_GROUPS: { key: string; label: string; statuses: IssueStatus[] }[] = [
  { key: "open", label: "Open", statuses: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_INFORMATION", "REOPENED", "ESCALATED"] },
  { key: "resolved", label: "Resolved", statuses: ["RESOLVED", "CLOSED"] },
];

export function MapExplorer({
  categories,
  defaultCenter,
}: {
  categories: { slug: string; name: string; icon: string }[];
  defaultCenter: { lat: number; lng: number; label: string };
}) {
  const router = useRouter();
  const [items, setItems] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [bounds, setBounds] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);
  const [group, setGroup] = useState<"open" | "resolved" | "all">("open");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [center, setCenter] = useState(defaultCenter);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchItems = useCallback(
    async (b: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
      const params = new URLSearchParams({
        minLat: String(b.minLat),
        maxLat: String(b.maxLat),
        minLng: String(b.minLng),
        maxLng: String(b.maxLng),
        limit: "500",
      });
      const statuses = group === "all" ? null : STATUS_GROUPS.find((g) => g.key === group)?.statuses ?? null;
      if (statuses) params.set("statuses", statuses.join(","));
      if (category) params.set("category", category);
      if (priority) params.set("priority", priority);
      setLoading(true);
      try {
        const res = await fetch(`/api/issues/map?${params}`, { cache: "no-store" });
        const data = (await res.json()) as { items?: MapPoint[]; error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "Couldn't load map data.");
          return;
        }
        setItems(data.items ?? []);
      } catch {
        toast.error("Network problem — couldn't refresh the map.");
      } finally {
        setLoading(false);
      }
    },
    [group, category, priority]
  );

  // Refetch whenever filters change (with the last known bounds).
  useEffect(() => {
    if (bounds) void fetchItems(bounds);
  }, [fetchItems, bounds]);

  const onBoundsChange = useCallback(
    (b: { minLat: number; maxLat: number; minLng: number; maxLng: number; zoom: number }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setBounds(b), 450);
    },
    []
  );

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your location" }),
      () => toast.error("Couldn't get your location. Please allow location access or search manually."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const markers: MapMarkerData[] = items.map((i) => ({
    id: i.id,
    latitude: i.latitude,
    longitude: i.longitude,
    title: i.title,
    status: i.status,
    categoryIcon: i.categoryIcon,
    publicId: i.publicId,
  }));

  const onMarkerClick = useCallback((m: MapMarkerData) => {
    setSelected(items.find((i) => i.id === m.id) ?? null);
  }, [items]);

  const list = (
    <ul className="divide-y divide-line" aria-label="Complaints in the current map area">
      {items.slice(0, 100).map((i) => (
        <li key={i.id}>
          <Link
            href={`/issues/${i.publicId}`}
            className="block px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{i.title}</p>
              <StatusBadge status={i.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <CategoryIcon name={i.categoryIcon} className="h-3 w-3" /> {i.category}
              </span>
              <PriorityBadge priority={i.priority} />
              {i.locality && <span>{i.locality}</span>}
              <span className="inline-flex items-center gap-0.5">
                <ThumbsUp className="h-3 w-3" aria-hidden /> {i.upvotesCount}
              </span>
              <span>{timeAgo(i.createdAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[540px] flex-col gap-3 lg:h-[calc(100dvh-7rem)]">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
        <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="Status filter">
          {(["open", "resolved", "all"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                group === g ? "bg-surface text-terra-700 shadow-sm" : "text-ink-muted hover:text-ink"
              )}
            >
              {g === "all" ? "Everything" : g}
            </button>
          ))}
        </div>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="w-auto min-w-40 text-xs"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </Select>
        <Select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Filter by priority"
          className="w-auto min-w-32 text-xs"
        >
          <option value="">Any priority</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={useMyLocation}>
          <Crosshair className="h-3.5 w-3.5" aria-hidden /> My location
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1 text-[11px] text-ink-muted sm:flex" aria-live="polite">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            {loading ? "Loading…" : `${items.length} complaint${items.length === 1 ? "" : "s"} in view`}
          </span>
          {/* Mobile map/list toggle */}
          <div className="flex rounded-lg bg-surface-2 p-0.5 lg:hidden" role="group" aria-label="Switch between map and list">
            <button
              onClick={() => setMobileView("map")}
              aria-pressed={mobileView === "map"}
              className={cn("rounded-md p-1.5", mobileView === "map" ? "bg-surface text-terra-700 shadow-sm" : "text-ink-muted")}
            >
              <MapIcon className="h-4 w-4" aria-hidden /> <span className="sr-only">Map view</span>
            </button>
            <button
              onClick={() => setMobileView("list")}
              aria-pressed={mobileView === "list"}
              className={cn("rounded-md p-1.5", mobileView === "list" ? "bg-surface text-terra-700 shadow-sm" : "text-ink-muted")}
            >
              <List className="h-4 w-4" aria-hidden /> <span className="sr-only">List view</span>
            </button>
          </div>
        </div>
      </div>

      {/* Map + side list */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_340px]">
        <div className={cn("relative min-h-[320px] overflow-hidden rounded-xl border border-line", mobileView === "list" && "hidden lg:block")}>
          <MapView
            center={{ lat: center.lat, lng: center.lng }}
            zoom={12}
            markers={markers}
            onBoundsChange={onBoundsChange}
            onMarkerClick={onMarkerClick}
            cluster
            showUserLocation
            className="h-full w-full"
            ariaLabel={`Map of civic complaints around ${center.label}`}
          />
          {loading && (
            <div className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-ink/85 px-3.5 py-1.5 text-[11px] font-semibold text-canvas shadow-lg" role="status">
              Updating map…
            </div>
          )}
          {selected && (
            <div className="absolute bottom-3 left-3 right-3 z-[500] rounded-xl border border-line bg-surface/97 p-4 shadow-xl backdrop-blur sm:left-3 sm:right-auto sm:max-w-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-bold leading-snug text-ink">{selected.title}</p>
                <button onClick={() => setSelected(null)} className="shrink-0 text-xs font-semibold text-ink-muted hover:text-ink" aria-label="Close details">✕</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={selected.status} />
                <PriorityBadge priority={selected.priority} />
                <span className="font-mono text-[10px] text-ink-muted">{selected.publicId}</span>
              </div>
              <Button size="sm" className="mt-3 w-full" onClick={() => router.push(`/issues/${selected.publicId}`)}>
                View full complaint
              </Button>
            </div>
          )}
        </div>

        {/* Accessible list alternative — always present on desktop */}
        <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface", mobileView === "map" && "hidden lg:flex")}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">In this area</h2>
            <span className="text-[11px] text-ink-muted" aria-live="polite">{items.length} shown</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 && !loading ? (
              <EmptyState
                icon={<MapIcon className="h-8 w-8" aria-hidden />}
                title="Nothing in this area"
                message="Try zooming out, switching to “Everything”, or clearing the category filter."
                className="border-0 py-10"
              />
            ) : (
              list
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
