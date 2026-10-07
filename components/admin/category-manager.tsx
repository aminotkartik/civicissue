"use client";

import { useState, type FormEvent } from "react";
import { Plus, Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CategoryIcon } from "@/components/ui/category-icon";

export interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  defaultDepartmentId: string | null;
  slaCriticalHours: number;
  slaHighHours: number;
  slaMediumHours: number;
  slaLowHours: number;
  active: boolean;
}

type DepartmentOption = { id: string; name: string };
type CategoryValues = Omit<CategoryRecord, "id" | "slug">;
const SLA_LABELS: [keyof Pick<CategoryValues, "slaCriticalHours" | "slaHighHours" | "slaMediumHours" | "slaLowHours">, string][] = [
  ["slaCriticalHours", "Critical · hours"], ["slaHighHours", "High · hours"], ["slaMediumHours", "Medium · hours"], ["slaLowHours", "Low · hours"],
];

export function CategoryManager({ categories, departments }: { categories: CategoryRecord[]; departments: DepartmentOption[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CategoryValues>({ name: "", description: "", icon: "cone", defaultDepartmentId: null, slaCriticalHours: 24, slaHighHours: 48, slaMediumHours: 120, slaLowHours: 240, active: true });

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't create this category.");
      toast.success("Issue category created."); window.location.reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't create this category."); }
    finally { setSaving(false); }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-ink">Issue categories</h2><p className="mt-0.5 text-xs text-ink-muted">Each category routes to a responsible department and can have its own resolution targets.</p></div><Button size="sm" variant={createOpen ? "secondary" : "primary"} onClick={() => setCreateOpen((value) => !value)}><Plus className="h-4 w-4" aria-hidden /> {createOpen ? "Close" : "Add category"}</Button></div>
      {createOpen && <CategoryForm title="Create category" values={draft} setValues={setDraft} departments={departments} loading={saving} onSubmit={create} submitLabel="Create category" />}
      {categories.length ? <div className="mt-5 grid gap-4 xl:grid-cols-2">{categories.map((category) => <CategoryEditor key={category.id} category={category} departments={departments} />)}</div> : <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">No issue categories configured.</p>}
    </section>
  );
}

function CategoryEditor({ category, departments }: { category: CategoryRecord; departments: DepartmentOption[] }) {
  const [values, setValues] = useState<CategoryValues>({
    name: category.name,
    description: category.description ?? "",
    icon: category.icon,
    defaultDepartmentId: category.defaultDepartmentId,
    slaCriticalHours: category.slaCriticalHours,
    slaHighHours: category.slaHighHours,
    slaMediumHours: category.slaMediumHours,
    slaLowHours: category.slaLowHours,
    active: category.active,
  });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: category.id, ...values }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't save this category.");
      toast.success("Category updated."); window.location.reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save this category."); }
    finally { setSaving(false); }
  }

  return (
    <article className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 p-4 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra-50 text-terra-700"><CategoryIcon name={category.icon} className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-ink">{category.name}</h3><p className="truncate text-[10px] text-ink-muted">/{category.slug} · {departments.find((d) => d.id === category.defaultDepartmentId)?.name ?? "No default department"}</p></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${values.active ? "bg-verdant-soft text-verdant" : "bg-surface-2 text-ink-muted"}`}>{values.active ? "Active" : "Inactive"}</span>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "Close" : "Edit"}</Button>
      </div>
      {expanded && <div className="border-t border-line p-4 sm:p-5"><CategoryForm title={`Edit ${category.name}`} values={values} setValues={setValues} departments={departments} loading={saving} onSubmit={save} submitLabel="Save category" /></div>}
    </article>
  );
}

function CategoryForm({ title, values, setValues, departments, loading, onSubmit, submitLabel }: {
  title: string;
  values: CategoryValues;
  setValues: (update: (current: CategoryValues) => CategoryValues) => void;
  departments: DepartmentOption[];
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  function patch<K extends keyof CategoryValues>(key: K, value: CategoryValues[K]) { setValues((current) => ({ ...current, [key]: value })); }
  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-canvas/70 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Tag className="h-4 w-4 text-terra-700" aria-hidden />{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category name" required>{(id) => <Input id={id} value={values.name} onChange={(event) => patch("name", event.target.value)} required minLength={2} maxLength={80} />}</Field>
        <Field label="Icon key" hint="Lucide category icon name; unknown keys use a civic marker.">{(id) => <Input id={id} value={values.icon} onChange={(event) => patch("icon", event.target.value)} maxLength={40} />}</Field>
        <Field label="Default department" optional className="sm:col-span-2">{(id) => <Select id={id} value={values.defaultDepartmentId ?? ""} onChange={(event) => patch("defaultDepartmentId", event.target.value || null)}><option value="">No default department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select>}</Field>
        <Field label="Description" optional className="sm:col-span-2">{(id) => <Textarea id={id} value={values.description ?? ""} onChange={(event) => patch("description", event.target.value)} maxLength={400} rows={2} />}</Field>
      </div>
      <fieldset className="mt-4"><legend className="text-xs font-bold text-ink">Service targets (hours)</legend><div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">{SLA_LABELS.map(([key, label]) => <Field key={key} label={label} required>{(id) => <Input id={id} type="number" min={1} max={key === "slaCriticalHours" || key === "slaHighHours" ? 720 : 4320} value={values[key]} onChange={(event) => patch(key, Number(event.target.value))} required />}</Field>)}</div><p className="mt-2 text-[10px] leading-relaxed text-ink-muted">Category-specific targets override the platform defaults. Overdue active reports are escalated by the next issue-list/SLA sweep.</p></fieldset>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs font-semibold text-ink-soft"><input type="checkbox" checked={values.active} onChange={(event) => patch("active", event.target.checked)} className="h-4 w-4 accent-terra-600" /> Category is active</label><Button type="submit" size="sm" loading={loading}><Save className="h-3.5 w-3.5" aria-hidden />{submitLabel}</Button></div>
    </form>
  );
}
