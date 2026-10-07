import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getActiveCategories } from "@/lib/queries/references";
import ReportWizard from "@/components/report/report-wizard";

export const metadata: Metadata = {
  title: "Report an issue",
  description: "Report a civic problem in your locality — add photos, pick the location and track it to resolution.",
  robots: { index: false },
};

export default async function ReportPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser().catch(() => null);
  if (!user) {
    // middleware protects this route; this is a fallback for direct API-less rendering
    return null;
  }
  const cats = await getActiveCategories();
  const query = searchParams ? await searchParams : {};
  const draftId = typeof query.draft === "string" ? query.draft : null;

  return (
    <ReportWizard
      initialDraftId={draftId}
      userName={user.name}
      userLocality={user.locality}
      userCity={user.city}
      categories={cats.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        description: c.description,
      }))}
    />
  );
}
