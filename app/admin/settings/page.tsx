import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getPriorityWeights, getSlaDefaults } from "@/lib/queries/settings";
import { SettingsManager } from "@/components/admin/settings-manager";

export const metadata: Metadata = { title: "Platform settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/settings");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const [weights, sla] = await Promise.all([getPriorityWeights(), getSlaDefaults()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav className="mb-4"><Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-terra-700 hover:underline"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Admin console</Link></nav>
      <header className="mb-6"><p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-terra-700"><Settings2 className="h-4 w-4" aria-hidden /> Platform policy</p><h1 className="text-2xl font-bold tracking-tight text-ink">Settings & service policy</h1><p className="mt-1 text-sm text-ink-muted">Tune explainable issue priority and SLA defaults. All changes are recorded in the audit log.</p></header>
      <SettingsManager initialWeights={weights} initialSla={sla} />
    </div>
  );
}
