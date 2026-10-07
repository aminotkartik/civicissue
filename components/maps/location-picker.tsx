"use client";

/**
 * Location capture step (spec §16, §17): three ways to pin a location —
 * browser geolocation, Nominatim search, or picking on the map — plus the
 * Exact/Approximate privacy choice.
 */
import { useCallback, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/format";
import type { MapMarkerData } from "@/components/maps/map-view";

const MapView = dynamic(() => import("@/components/maps/map-view"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

export interface LocationValue {
  latitude: number | null;
  longitude: number | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  locality: string;
  zone: string;
  locationPrivacy: "EXACT" | "APPROXIMATE";
}

export const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];

const PUNE_CENTER = { lat: 18.5204, lng: 73.8567 };

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

export function LocationPicker({
  value,
  onChange,
  defaultLocality,
  defaultCity,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  defaultLocality?: string | null;
  defaultCity?: string | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (patch: Partial<LocationValue>) => onChange({ ...value, ...patch });

  const applyPoint = useCallback(
    async (lat: number, lng: number, opts?: { skipReverse?: boolean }) => {
      set({ latitude: lat, longitude: lng });
      if (opts?.skipReverse) return;
      setGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { Accept: "application/json" } }
        );
        if (!res.ok) throw new Error("reverse geocode failed");
        const data = (await res.json()) as NominatimResult;
        const a = data.address ?? {};
        set({
          latitude: lat,
          longitude: lng,
          address: [a.road, a.neighbourhood || a.suburb].filter(Boolean).join(", ") || value.address,
          locality: a.suburb || a.neighbourhood || a.quarter || a.city_district || value.locality,
          city: a.city || a.town || a.village || value.city,
          state: a.state ?? value.state,
          pincode: a.postcode ?? value.pincode,
        });
      } catch {
        // Offline / rate-limited: keep the pin, fields stay editable.
      } finally {
        setGeocoding(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value]
  );

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Your browser doesn't support location services. Search or pick on the map instead.");
      return;
    }
    setGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyPoint(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setGeocoding(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can search for a place or pick the spot on the map instead."
            : "We couldn't get your location. Please try again or pick it manually."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const doSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 3) {
      setSearchResults(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`,
          { headers: { Accept: "application/json" } }
        );
        if (!res.ok) throw new Error();
        setSearchResults((await res.json()) as NominatimResult[]);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const pickResult = (r: NominatimResult) => {
    const a = r.address ?? {};
    setSearchResults(null);
    setSearchQuery(r.display_name.split(",").slice(0, 2).join(","));
    onChange({
      ...value,
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      address: r.display_name.split(",").slice(0, 3).join(", "),
      locality: a.suburb || a.neighbourhood || a.quarter || value.locality,
      city: a.city || a.town || a.village || value.city,
      state: a.state ?? value.state,
      pincode: a.postcode ?? value.pincode,
    });
  };

  const center =
    value.latitude !== null && value.longitude !== null
      ? { lat: value.latitude, lng: value.longitude }
      : { lat: PUNE_CENTER.lat, lng: PUNE_CENTER.lng };
  const pickMarker: { lat: number; lng: number } | null =
    value.latitude !== null && value.longitude !== null
      ? { lat: value.latitude, lng: value.longitude }
      : null;

  return (
    <div className="space-y-5">
      {/* Option A: current location */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={useMyLocation} disabled={geocoding}>
          {geocoding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
          Use my current location
        </Button>
      </div>
      {geoError && (
        <p className="rounded-lg bg-amber-soft px-3.5 py-2.5 text-xs font-medium text-ink-soft" role="alert">
          {geoError}
        </p>
      )}

      {/* Option B: search */}
      <div className="relative">
        <Field label="Search for a place" hint="Landmarks work best — “Kothrud bus depot”, “City Mall main gate”.">
          {(id) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input
                id={id}
                type="text"
                autoComplete="off"
                className="pl-10"
                placeholder="Search a place or address…"
                value={searchQuery}
                onChange={(e) => doSearch(e.target.value)}
                aria-label="Search for a location"
              />
              {searching && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted" aria-hidden />}
            </div>
          )}
        </Field>
        {searchResults && (
          <ul className="absolute z-[600] mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-pop" role="listbox" aria-label="Search results">
            {searchResults.length === 0 && (
              <li className="px-4 py-3 text-xs text-ink-muted">
                No places found. Try a different spelling, or pick the spot on the map below.
              </li>
            )}
            {searchResults.map((r, i) => (
              <li key={`${r.lat}-${r.lon}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected
                  onClick={() => pickResult(r)}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left text-xs leading-relaxed text-ink-soft hover:bg-surface-2"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terra-600" aria-hidden />
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Option C: pick on map */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
          Or pick the spot on the map
          {geocoding && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" aria-hidden />}
        </p>
        <div className="h-64 overflow-hidden rounded-xl border border-line sm:h-80">
          <MapView
            center={center}
            zoom={value.latitude ? 16 : 12}
            pickMarker={pickMarker}
            onPick={(lat, lng) => void applyPoint(lat, lng)}
            cluster={false}
            className="h-full w-full"
            ariaLabel="Map for choosing the issue location"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-muted">
          Tap anywhere on the map to drop the pin, then drag it to fine-tune.{" "}
          {value.latitude !== null && value.longitude !== null && (
            <span className="font-mono">
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </span>
          )}
        </p>
      </div>

      {/* Structured location fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address / landmark" optional>
          {(id) => <Input id={id} value={value.address} onChange={(e) => set({ address: e.target.value })} placeholder="University Road, near gate 2" maxLength={300} />}
        </Field>
        <Field label="Locality / area" hint="Shown publicly on the issue card.">
          {(id) => <Input id={id} value={value.locality} onChange={(e) => set({ locality: e.target.value })} placeholder={defaultLocality ?? "Kothrud"} maxLength={160} />}
        </Field>
        <Field label="City">
          {(id) => <Input id={id} value={value.city} onChange={(e) => set({ city: e.target.value })} placeholder={defaultCity ?? "Pune"} maxLength={120} />}
        </Field>
        <Field label="Zone" optional hint="Used for department routing and hotspot analytics.">
          {(id) => (
            <Select id={id} value={value.zone} onChange={(e) => set({ zone: e.target.value })} aria-label="City zone">
              <option value="">Select zone…</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="State" optional>
          {(id) => <Input id={id} value={value.state} onChange={(e) => set({ state: e.target.value })} placeholder="Maharashtra" maxLength={120} />}
        </Field>
        <Field label="Pincode" optional error={value.pincode && !/^\d{5,6}$/.test(value.pincode) ? "Pincode must be 5–6 digits." : null}>
          {(id) => <Input id={id} inputMode="numeric" value={value.pincode} onChange={(e) => set({ pincode: e.target.value.replace(/[^\d]/g, "").slice(0, 6) })} placeholder="411038" />}
        </Field>
      </div>

      {/* Privacy choice */}
      <fieldset className="rounded-xl border border-line bg-surface-2/50 p-4">
        <legend className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <ShieldCheck className="h-3.5 w-3.5 text-verdant" aria-hidden /> Location privacy
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              { v: "EXACT", title: "Show exact location", desc: "The public map shows your precise pin." },
              { v: "APPROXIMATE", title: "Show approximate area", desc: "Public map shows a ~500 m blurred point. Authority & field workers still see the exact spot to find the problem." },
            ] as const
          ).map((opt) => (
            <label
              key={opt.v}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
                value.locationPrivacy === opt.v
                  ? "border-terra-400 bg-terra-50"
                  : "border-line bg-surface hover:border-line-strong"
              )}
            >
              <input
                type="radio"
                name="locationPrivacy"
                value={opt.v}
                checked={value.locationPrivacy === opt.v}
                onChange={() => set({ locationPrivacy: opt.v })}
                className="mt-0.5 accent-[#bf4726]"
              />
              <span>
                <span className="block text-[13px] font-semibold text-ink">{opt.title}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">{opt.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export type { MapMarkerData };
