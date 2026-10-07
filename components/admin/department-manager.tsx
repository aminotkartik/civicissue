"use client";

import { useState, type FormEvent } from "react";
import { Building2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

export interface DepartmentRecord {
  id: string;
  name: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  zones: string | null;
  active: boolean;
  workerCount: number;
}

export function DepartmentManager({ departments }: { departments: DepartmentRecord[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [zones, setZones] = useState("");
  const [saving, setSaving] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, contactEmail, contactPhone, zones, active: true }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't create this department.");
      toast.success("Department created.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create this department.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-ink">Municipal departments</h2><p className="mt-0.5 text-xs text-ink-muted">Routing destinations for categories, staff and service zones.</p></div><Button size="sm" variant={createOpen ? "secondary" : "primary"} onClick={() => setCreateOpen((value) => !value)}><Plus className="h-4 w-4" aria-hidden /> {createOpen ? "Close" : "Add department"}</Button></div>
      {createOpen && <form onSubmit={create} className="mb-5 rounded-2xl border border-terra-200 bg-terra-50/35 p-4 sm:p-5"><h3 className="text-sm font-bold text-ink">Create department</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Department name" required>{(id) => <Input id={id} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} />}</Field>
        <Field label="Contact email" optional>{(id) => <Input id={id} type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />}</Field>
        <Field label="Contact phone" optional>{(id) => <Input id={id} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength={20} />}</Field>
        <Field label="Service zones" optional hint="Comma-separated zone names." className="lg:col-span-3">{(id) => <Input id={id} value={zones} onChange={(event) => setZones(event.target.value)} maxLength={300} placeholder="North Zone, Central Zone" />}</Field>
        <Field label="Description" optional className="sm:col-span-2 lg:col-span-3">{(id) => <Textarea id={id} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} rows={3} />}</Field>
      </div><div className="mt-4 flex justify-end"><Button type="submit" loading={saving}>Create department</Button></div></form>}
      {departments.length ? <div className="grid gap-4 lg:grid-cols-2">{departments.map((department) => <DepartmentEditor key={department.id} department={department} />)}</div> : <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">No departments configured.</p>}
    </section>
  );
}

function DepartmentEditor({ department }: { department: DepartmentRecord }) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description ?? "");
  const [contactEmail, setContactEmail] = useState(department.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(department.contactPhone ?? "");
  const [zones, setZones] = useState(department.zones ?? "");
  const [active, setActive] = useState(department.active);
  const [saving, setSaving] = useState(false);
  const dirty = name !== department.name || description !== (department.description ?? "") || contactEmail !== (department.contactEmail ?? "") || contactPhone !== (department.contactPhone ?? "") || zones !== (department.zones ?? "") || active !== department.active;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: department.id, name, description, contactEmail, contactPhone, zones, active }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't save department changes.");
      toast.success("Department updated.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save department changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra-50 text-terra-700"><Building2 className="h-4 w-4" aria-hidden /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-ink">{department.name}</p><p className="text-[10px] text-ink-muted">{department.workerCount} field workers</p></div></div><label className="flex items-center gap-2 text-xs font-semibold text-ink-soft"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-terra-600" /> Active</label></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>{(id) => <Input id={id} value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />}</Field>
        <Field label="Contact email" optional>{(id) => <Input id={id} type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />}</Field>
        <Field label="Contact phone" optional>{(id) => <Input id={id} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength={20} />}</Field>
        <Field label="Zones" optional>{(id) => <Input id={id} value={zones} onChange={(event) => setZones(event.target.value)} maxLength={300} />}</Field>
        <Field label="Description" optional className="sm:col-span-2">{(id) => <Textarea id={id} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} rows={2} />}</Field>
      </div>
      <div className="mt-4 flex justify-end"><Button type="submit" size="sm" disabled={!dirty} loading={saving}><Save className="h-3.5 w-3.5" aria-hidden /> Save changes</Button></div>
    </form>
  );
}
