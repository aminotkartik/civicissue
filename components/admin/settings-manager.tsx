"use client";

import { useState } from "react";
import { Gauge, Save, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { PriorityWeights } from "@/lib/priority/engine";
import type { Priority } from "@/lib/types";

const WEIGHT_FIELDS: { key: keyof PriorityWeights; label: string; detail: string }[] = [
  { key: "severity", label: "Reported severity", detail: "Citizen-selected urgency" },
  { key: "community", label: "Community support", detail: "Upvotes and confirmations" },
  { key: "location", label: "Location importance", detail: "Schools, hospitals, transit, main roads" },
  { key: "safety", label: "Safety impact", detail: "Risk and public-health signals" },
  { key: "duration", label: "Duration", detail: "How long the problem has persisted" },
  { key: "category", label: "Infrastructure type", detail: "Baseline category criticality" },
];
const SLA_FIELDS: { key: Priority; label: string; max: number }[] = [
  { key: "CRITICAL", label: "Critical", max: 720 },
  { key: "HIGH", label: "High", max: 720 },
  { key: "MEDIUM", label: "Medium", max: 2160 },
  { key: "LOW", label: "Low", max: 4320 },
];

export function SettingsManager({ initialWeights, initialSla }: { initialWeights: PriorityWeights; initialSla: Record<Priority, number> }) {
  const [weights, setWeights] = useState(initialWeights);
  const [sla, setSla] = useState(initialSla);
  const [saving, setSaving] = useState<"weights" | "sla" | null>(null);
  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0);

  async function save(key: "priority_weights" | "sla_defaults") {
    const group = key === "priority_weights" ? "weights" : "sla";
    const value = key === "priority_weights" ? weights : sla;
    setSaving(group);
    try {
      const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't save platform settings.");
      toast.success(key === "priority_weights" ? "Priority weights saved." : "Platform SLA targets saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save platform settings.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-terra-50 text-terra-700"><Gauge className="h-5 w-5" aria-hidden /></span><div><h2 className="text-base font-bold text-ink">Explainable priority weights</h2><p className="text-xs text-ink-muted">Each score factor is transparent and configurable.</p></div></div>
        <div className="space-y-3">{WEIGHT_FIELDS.map(({ key, label, detail }) => <div key={key} className="grid grid-cols-[1fr_86px] items-center gap-3"><label htmlFor={`weight-${key}`}><span className="block text-xs font-semibold text-ink">{label}</span><span className="block text-[10px] text-ink-muted">{detail}</span></label><div className="relative"><Input id={`weight-${key}`} type="number" min={0} max={100} value={weights[key]} onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} className="pr-8 text-right tabular-nums" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted">pts</span></div></div>)}</div>
        <div className={`mt-4 flex items-center justify-between rounded-lg px-3 py-2 text-xs ${weightTotal === 100 ? "bg-verdant-soft text-verdant" : "bg-alert-soft text-alert"}`}><span>Maximum score weight</span><strong>{weightTotal} / 100</strong></div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">Weights must total 100. New reports and subsequent priority recalculations use these values; historic scores are not silently rewritten.</p>
        <div className="mt-4 flex justify-end"><Button onClick={() => void save("priority_weights")} loading={saving === "weights"} disabled={weightTotal !== 100}><Save className="h-4 w-4" aria-hidden /> Save weights</Button></div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-soft text-amber-accent"><Timer className="h-5 w-5" aria-hidden /></span><div><h2 className="text-base font-bold text-ink">Platform SLA defaults</h2><p className="text-xs text-ink-muted">Category-specific exceptions can be set separately.</p></div></div>
        <div className="space-y-3">{SLA_FIELDS.map(({ key, label, max }) => <Field key={key} label={`${label} priority`} hint={`1 to ${max} hours.`}>{(id) => <div className="relative"><Input id={id} type="number" min={1} max={max} value={sla[key]} onChange={(event) => setSla((current) => ({ ...current, [key]: Number(event.target.value) }))} required className="pr-14" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">hours</span></div>}</Field>)}</div>
        <p className="mt-4 rounded-lg bg-info-soft px-3 py-2 text-[11px] leading-relaxed text-info">SLA defaults apply to categories still on the built-in baseline. Categories with a custom target keep their override. Existing deadlines are retained; newly created, verified, reopened or reprioritized issues use the updated policy.</p>
        <div className="mt-4 flex justify-end"><Button onClick={() => void save("sla_defaults")} loading={saving === "sla"}><Save className="h-4 w-4" aria-hidden /> Save SLA defaults</Button></div>
      </section>
    </div>
  );
}
