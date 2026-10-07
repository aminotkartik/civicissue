"use client";

/**
 * Single-issue map (client wrapper so Leaflet never runs during SSR).
 */
import dynamic from "next/dynamic";
import type { MapMarkerData } from "@/components/maps/map-view";
import type { IssueStatus } from "@/lib/types";

const MapView = dynamic(() => import("@/components/maps/map-view"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-xl bg-surface-2" aria-hidden />
  ),
});

export function IssueMap({
  latitude,
  longitude,
  status,
  title,
  categoryIcon,
  publicId,
  obscured,
  className,
}: {
  latitude: number;
  longitude: number;
  status: IssueStatus;
  title: string;
  categoryIcon?: string;
  publicId: string;
  obscured?: boolean;
  className?: string;
}) {
  const marker: MapMarkerData = {
    id: publicId,
    latitude,
    longitude,
    title,
    status,
    categoryIcon,
    publicId,
  };
  return (
    <div className={className}>
      <MapView
        center={{ lat: latitude, lng: longitude }}
        zoom={obscured ? 14 : 16}
        markers={[marker]}
        className="h-64 w-full rounded-xl"
        scrollWheelZoom={false}
      />
      {obscured && (
        <p className="mt-1.5 text-[11px] text-ink-muted">
          📍 Approximate location — the reporter chose to hide the exact spot for privacy.
        </p>
      )}
    </div>
  );
}
