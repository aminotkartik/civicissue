import type { Metadata } from "next";
import { NearbyExplorer } from "@/components/map/nearby-explorer";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Nearby reports",
  description: "Find active and resolved civic issue reports near your current location or neighbourhood.",
};
export const dynamic = "force-dynamic";

const CENTERS: Record<string, { lat: number; lng: number }> = {
  pune: { lat: 18.5204, lng: 73.8567 },
  pimpri: { lat: 18.6298, lng: 73.7997 },
  "pimpri-chinchwad": { lat: 18.6298, lng: 73.7997 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
};

export default async function NearbyPage() {
  const user = await getCurrentUser().catch(() => null);
  const label = user?.locality || user?.city || "Pune";
  const key = label.toLowerCase().trim();
  const center = CENTERS[key] ?? CENTERS.pune!;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Nearby reports</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
          See what residents have reported around you. Your precise location is used only in your browser to find nearby issues — it is never saved or shared.
        </p>
      </header>
      <NearbyExplorer initialCenter={center} cityLabel={label} />
    </div>
  );
}
