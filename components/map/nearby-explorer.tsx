"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { Crosshair, List, Map as MapIcon, MapPin, RefreshCw } from "lucide-react";
import { IssueCard } from "@/components/issues/issue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/format";
import type { IssueCardData, IssueStatus } from "@/lib/types";
import type { MapMarkerData } from "@/components/maps/map-view";

const MapView = dynamic(() => import("@/components/maps/map-view"), {
  ssr: false,
  loading: () => <div className="h-full min-h-72 animate-pulse rounded-xl bg-surface-2" role="status" aria-label="Loading map" />,
});

type NearbyIssue = IssueCardData & { distanceKm: number };

export function NearbyExplorer({ initialCenter, cityLabel }: {
  initialCenter: { lat: number; lng: number };
  cityLabel: string;
}) {
  const [center, setCenter] = useState(initialCenter);
  const [radius, setRadius] = useState("2");
  const [items, setItems] = useState<NearbyIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [locationLabel, setLocationLabel] = useState(cityLabel);

  const loadNearby = useCallback(async (coords = center, distance = radius) => {
    setLoading(true);
    const params = new URLSearchParams({
      latitude: String(coords.lat),
      longitude: String(coords.lng),
      radiusKm: distance,
      limit: "100",
    });
    try {
      const response = await fetch(`/api/issues/nearby?${params.toString()}`, { cache: "no-store" });
      const data = await response.json() as { items?: NearbyIssue[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't load nearby reports.");
      setItems(data.items ?? []);
      setHasSearched(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network problem — couldn't load nearby reports.");
    } finally {
      setLoading(false);
    }
  }, [center, radius]);

  useEffect(() => {
    void loadNearby(initialCenter, radius);
    // Load once at the server-selected city center; user can opt into precise geolocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasSearched) void loadNearby(center, radius);
  }, [center, radius, hasSearched, loadNearby]);

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("This browser doesn't support location services.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCenter(next);
        setLocationLabel("Your current location");
        setLocating(false);
        setHasSearched(true);
      },
      () => {
        toast.error("Location access wasn't available. You can still browse around the city centre.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const markers: MapMarkerData[] = items.map((item) => ({
    id: item.id,
    publicId: item.publicId,
    title: item.title,
    latitude: item.latitude,
    longitude: item.longitude,
    status: item.status as IssueStatus,
  }));

  return (
    <section aria-label="Nearby civic reports">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
        <div className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-ink">
          <MapPin className="h-4 w-4 shrink-0 text-terra-600" aria-hidden />
          <span className="truncate" aria-live="polite">{locationLabel}</span>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          Search radius
          <Select value={radius} onChange={(event) => setRadius(event.target.value)} aria-label="Search radius" className="w-28 text-sm">
            <option value="0.5">500 m</option>
            <option value="1">1 km</option>
            <option value="2">2 km</option>
            <option value="5">5 km</option>
          </Select>
        </label>
        <Button variant="outline" size="sm" onClick={locate} loading={locating}>
          <Crosshair className="h-3.5 w-3.5" aria-hidden /> Use my location
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void loadNearby()} loading={loading} aria-label="Refresh nearby reports">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
        </Button>
        <div className="ml-auto flex rounded-lg bg-surface-2 p-0.5 sm:hidden" role="group" aria-label="View mode">
          <button className={cn("rounded-md p-1.5", view === "list" ? "bg-surface text-terra-700 shadow-sm" : "text-ink-muted")} onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="List view">
            <List className="h-4 w-4" aria-hidden />
          </button>
          <button className={cn("rounded-md p-1.5", view === "map" ? "bg-surface text-terra-700 shadow-sm" : "text-ink-muted")} onClick={() => setView("map")} aria-pressed={view === "map"} aria-label="Map view">
            <MapIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-muted" aria-live="polite">
        {loading ? "Finding reports…" : hasSearched ? `${items.length} open or resolved report${items.length === 1 ? "" : "s"} within ${radius} km, nearest first.` : "Choose a location to find reports nearby."}
      </p>

      {items.length === 0 && !loading && hasSearched ? (
        <EmptyState
          className="mt-5"
          icon={<MapPin className="h-6 w-6" aria-hidden />}
          title="No reports in this radius"
          message="Try a wider radius or use your current location to check another neighbourhood."
          action={<Link href="/report" className="inline-flex h-10 items-center justify-center rounded-lg bg-terra-600 px-4 text-sm font-semibold text-white hover:bg-terra-700">Report an issue</Link>}
        />
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
          <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", view === "map" && "hidden sm:grid")}>
            {items.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
            {loading && items.length === 0 && Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-72 rounded-xl" />)}
          </div>
          <div className={cn("h-[min(70vh,720px)] min-h-80 overflow-hidden rounded-xl border border-line bg-surface", view === "list" && "hidden sm:block")}>
            <MapView
              center={center}
              zoom={13}
              markers={markers}
              cluster
              showUserLocation
              ariaLabel={`Map showing reports within ${radius} kilometres of ${locationLabel}`}
              className="h-full w-full"
              onMarkerClick={(marker) => {
                const item = items.find((candidate) => candidate.id === marker.id);
                if (item) window.location.href = `/issues/${item.publicId}`;
              }}
            />
          </div>
          {/* Screen-reader instruction plus simple external map/list alternative on small screens. */}
          <p className="sr-only">The report list is sorted by distance. Each report links to its full details.</p>
        </div>
      )}
    </section>
  );
}
