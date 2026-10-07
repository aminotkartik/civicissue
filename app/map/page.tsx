import type { Metadata } from "next";
import { getActiveCategories } from "@/lib/queries/references";
import { MapExplorer } from "@/components/map/map-explorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Issue map",
  description:
    "Explore civic complaints across the city on an interactive map — filter by status, category and priority.",
};

/** Simple city lookup so the map opens centred on the viewer's city. */
const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  pune: { lat: 18.5204, lng: 73.8567 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  "new delhi": { lat: 28.6139, lng: 77.209 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
};

export default async function MapPage() {
  const categories = await getActiveCategories();
  const defaultCenter = { ...CITY_CENTERS.pune!, label: "Pune" };

  return (
    <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Issue map</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Every dot is a real complaint. Colours show status — hover or tap a marker for details.
          Use the list panel for a screen-reader friendly alternative.
        </p>
      </div>
      <MapExplorer
        defaultCenter={defaultCenter}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }))}
      />
    </main>
  );
}
