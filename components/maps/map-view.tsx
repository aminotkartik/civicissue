"use client";

/**
 * CivicIssue map view — Leaflet + OpenStreetMap (no API token required).
 *
 * Features: issue pin markers coloured by status, grid-based clustering at
 * low zoom, current-location control, viewport bbox reporting for
 * server-side filtering, and marker click callbacks. Leaflet is imported
 * dynamically so the component is SSR-safe.
 */
import { useEffect, useRef, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import type { IssueStatus } from "@/lib/types";
import { cn } from "@/lib/utils/format";

export interface MapMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  status?: IssueStatus;
  categoryIcon?: string;
  publicId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "#3f6f9f",
  UNDER_REVIEW: "#d9930d",
  WAITING_FOR_INFORMATION: "#d9930d",
  VERIFIED: "#4d8a5b",
  ASSIGNED: "#3f6f9f",
  IN_PROGRESS: "#7a5aa6",
  RESOLVED: "#4d8a5b",
  CLOSED: "#8a8175",
  REJECTED: "#c04545",
  REOPENED: "#d9930d",
  ESCALATED: "#c04545",
};

export interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarkerData[];
  /** Single draggable marker for location picking. */
  pickMarker?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: MapMarkerData) => void;
  onBoundsChange?: (b: { minLat: number; maxLat: number; minLng: number; maxLng: number; zoom: number }) => void;
  showUserLocation?: boolean;
  cluster?: boolean;
  className?: string;
  ariaLabel?: string;
  scrollWheelZoom?: boolean;
}

// Minimal Leaflet typings to avoid heavy type coupling in the component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type L = any;

export default function MapView({
  center,
  zoom = 13,
  markers = [],
  pickMarker,
  onPick,
  onMarkerClick,
  onBoundsChange,
  showUserLocation,
  cluster = true,
  className,
  ariaLabel = "Interactive map of civic issues",
  scrollWheelZoom = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L>(null);
  const layerRef = useRef<L>(null);
  const pickLayerRef = useRef<L>(null);
  const leafletRef = useRef<L>(null);
  const userMarkerRef = useRef<L>(null);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onBoundsRef = useRef(onBoundsChange);
  const onPickRef = useRef(onPick);
  onMarkerClickRef.current = onMarkerClick;
  onBoundsRef.current = onBoundsChange;
  onPickRef.current = onPick;

  // Initialise map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (disposed || !containerRef.current) return;
      leafletRef.current = leaflet;
      const map = leaflet.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        scrollWheelZoom,
        zoomControl: true,
      });
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
        .addTo(map);
      mapRef.current = map;
      layerRef.current = leaflet.layerGroup().addTo(map);
      pickLayerRef.current = leaflet.layerGroup().addTo(map);

      map.on("moveend zoomend", () => {
        const b = map.getBounds();
        onBoundsRef.current?.({
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
          minLng: b.getWest(),
          maxLng: b.getEast(),
          zoom: map.getZoom(),
        });
      });
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (onPickRef.current) onPickRef.current(e.latlng.lat, e.latlng.lng);
      });
      // Fire initial bounds.
      setTimeout(() => {
        const b = map.getBounds();
        onBoundsRef.current?.({
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
          minLng: b.getWest(),
          maxLng: b.getEast(),
          zoom: map.getZoom(),
        });
      }, 300);
    })();
    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        pickLayerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render markers with simple grid clustering below zoom 14.
  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!leaflet || !map || !layer) return;
    layer.clearLayers();
    if (!markers.length) return;

    const currentZoom = map.getZoom();
    const useClustering = cluster && currentZoom < 14 && markers.length > 1;

    const pinIcon = (color: string) =>
      leaflet.divIcon({
        className: "",
        html: `<div class="civic-pin" style="background:${color}"><span>📍</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 28],
      });

    if (!useClustering) {
      for (const m of markers) {
        const marker = leaflet.marker([m.latitude, m.longitude], {
          icon: pinIcon(STATUS_COLORS[m.status ?? "SUBMITTED"] ?? "#bf4726"),
          title: m.title ?? m.publicId ?? "",
          alt: m.title ?? "issue marker",
          keyboard: true,
        });
        if (m.title) {
          marker.bindTooltip(
            `<div style="font-family:inherit"><strong>${escapeHtml(m.title)}</strong><br/><span style="font-size:11px">${m.publicId ?? ""}</span></div>`,
            { direction: "top", offset: [0, -24] }
          );
        }
        marker.on("click", () => onMarkerClickRef.current?.(m));
        layer.addLayer(marker);
      }
      return;
    }

    // Grid clustering (~cell size shrinks with zoom).
    const cell = currentZoom < 10 ? 0.08 : currentZoom < 12 ? 0.03 : 0.012;
    const groups = new Map<string, MapMarkerData[]>();
    for (const m of markers) {
      const key = `${Math.floor(m.latitude / cell)}:${Math.floor(m.longitude / cell)}`;
      const g = groups.get(key) ?? [];
      g.push(m);
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      const lat = g.reduce((s, m) => s + m.latitude, 0) / g.length;
      const lng = g.reduce((s, m) => s + m.longitude, 0) / g.length;
      if (g.length === 1) {
        const m = g[0]!;
        const marker = leaflet.marker([m.latitude, m.longitude], {
          icon: pinIcon(STATUS_COLORS[m.status ?? "SUBMITTED"] ?? "#bf4726"),
          title: m.title ?? "",
        });
        marker.on("click", () => onMarkerClickRef.current?.(m));
        layer.addLayer(marker);
        continue;
      }
      const hasCritical = g.some((m) => m.status === "ESCALATED" || m.status === "REJECTED");
      const size = Math.min(52, 30 + g.length);
      const clusterMarker = leaflet.marker([lat, lng], {
        icon: leaflet.divIcon({
          className: "",
          html: `<div class="civic-cluster" style="width:${size}px;height:${size}px;${hasCritical ? "background:#c04545" : ""}">${g.length}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
      });
      clusterMarker.on("click", () => {
        map.setView([lat, lng], Math.min(17, currentZoom + 3));
      });
      layer.addLayer(clusterMarker);
    }
  }, [markers, cluster]);

  // Re-cluster on zoom changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => {
      // Trigger marker effect by forcing a bounds report (parent may refetch).
      const b = map.getBounds();
      onBoundsRef.current?.({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
        zoom: map.getZoom(),
      });
    };
    map.on("zoomend", handler);
    return () => map.off("zoomend", handler);
  }, []);

  // Draggable pick marker.
  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const pickLayer = pickLayerRef.current;
    if (!leaflet || !map || !pickLayer) return;
    pickLayer.clearLayers();
    if (!pickMarker) return;
    const marker = leaflet.marker([pickMarker.lat, pickMarker.lng], {
      draggable: !!onPickRef.current,
      icon: leaflet.divIcon({
        className: "",
        html: '<div class="civic-pin" style="background:#bf4726;width:36px;height:36px"><span style="font-size:15px">📌</span></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 34],
      }),
      zIndexOffset: 1000,
    });
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onPickRef.current?.(p.lat, p.lng);
    });
    pickLayer.addLayer(marker);
    if (!map.getBounds().contains([pickMarker.lat, pickMarker.lng])) {
      map.panTo([pickMarker.lat, pickMarker.lng]);
    }
  }, [pickMarker]);

  // Recenter when the `center` prop changes meaningfully (e.g. search result).
  const lastCenter = useRef(center);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const prev = lastCenter.current;
    if (Math.abs(prev.lat - center.lat) > 1e-6 || Math.abs(prev.lng - center.lng) > 1e-6) {
      lastCenter.current = center;
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), zoom));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  const locate = useCallback(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 15);
        if (userMarkerRef.current) userMarkerRef.current.remove();
        userMarkerRef.current = leaflet
          .circleMarker([latitude, longitude], {
            radius: 8,
            color: "#3f6f9f",
            fillColor: "#3f6f9f",
            fillOpacity: 0.35,
            weight: 2,
          })
          .addTo(map);
        onPickRef.current?.(latitude, longitude);
      },
      () => {
        /* permission denied — silent, the search fallback remains */
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return (
    <div className={cn("relative", className)} style={{ minHeight: 200 }}>
      <div ref={containerRef} className="h-full w-full" role="application" aria-label={ariaLabel} />
      {showUserLocation && (
        <button
          type="button"
          onClick={locate}
          className="absolute right-3 bottom-6 z-[500] rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-card hover:bg-surface-2"
          style={{ position: "absolute" }}
          aria-label="Use my current location"
        >
          ◎ My location
        </button>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
