/**
 * Geospatial helpers — dialect-neutral (no PostGIS dependency).
 * Distance filtering is done with an indexed bounding-box query followed by
 * an exact haversine computation in application code.
 */

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Bounding box (lat/lng deltas) approximating a radius in km. */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/**
 * Obscures a coordinate for public display when the reporter chose
 * APPROXIMATE privacy: snaps to a ~550 m grid and jitters deterministically
 * by the issue id so the point is stable but not exact.
 */
export function obscureCoordinate(
  lat: number,
  lng: number,
  seed: string
): { latitude: number; longitude: number } {
  const grid = 0.005; // ~550m
  const snappedLat = Math.round(lat / grid) * grid + grid / 2;
  const snappedLng = Math.round(lng / grid) * grid + grid / 2;
  // Deterministic jitter within ±40% of a grid cell.
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const j1 = ((h % 1000) / 1000 - 0.5) * grid * 0.8;
  const j2 = (((h >> 10) % 1000) / 1000 - 0.5) * grid * 0.8;
  return {
    latitude: round6(snappedLat + j1),
    longitude: round6(snappedLng + j2),
  };
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
