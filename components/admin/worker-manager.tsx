"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BriefcaseBusiness, Plus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface WorkerRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  employeeId: string;
  departmentId: string;
  departmentName: string;
  zone: string | null;
  phone: string | null;
  active: boolean;
}

export function WorkerManager({ departments }: { departments: { id: string; name: string }[] }) {
  const [items, setItems] = useState<WorkerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [zone, setZone] = useState("");
  const [phone, setPhone] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/workers", { cache: "no-store" });
      const data = await response.json() as { items?: WorkerRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't load the field-worker register.");
      setItems(data.items ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load field workers.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, temporaryPassword, employeeId, departmentId, zone, phone }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't create the field-worker account.");
      toast.success("Worker account and field profile created.");
      setName(""); setEmail(""); setTemporaryPassword(""); setEmployeeId(""); setZone(""); setPhone("");
      setCreateOpen(false);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the field-worker account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-9" aria-labelledby="worker-registry-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-terra-700"><BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden /> Staff registry</p><h2 id="worker-registry-title" className="text-lg font-bold text-ink">Field workers</h2><p className="mt-0.5 text-xs text-ink-muted">Worker login, employee ID, department and active status are kept in sync.</p></div>
        <Button variant={createOpen ? "secondary" : "primary"} size="sm" onClick={() => setCreateOpen((value) => !value)}><Plus className="h-4 w-4" aria-hidden /> {createOpen ? "Close form" : "Add field worker"}</Button>
      </div>

      {createOpen && (
        <form onSubmit={create} className="mt-4 rounded-2xl border border-terra-200 bg-terra-50/35 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-ink">Create field-worker account</h3>
          <p className="mt-1 text-xs text-ink-muted">The worker can change this temporary password after signing in.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Full name" required>{(id) => <Input id={id} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} />}</Field>
            <Field label="Email address" required>{(id) => <Input id={id} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="off" />}</Field>
            <Field label="Temporary password" required hint="At least 8 characters.">{(id) => <Input id={id} type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required minLength={8} autoComplete="new-password" />}</Field>
            <Field label="Employee ID" required>{(id) => <Input id={id} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required minLength={2} maxLength={30} />}</Field>
            <Field label="Department" required>{(id) => <Select id={id} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select>}</Field>
            <Field label="Zone / area" optional>{(id) => <Input id={id} value={zone} onChange={(event) => setZone(event.target.value)} maxLength={80} placeholder="e.g. West Zone" />}</Field>
            <Field label="Phone" optional>{(id) => <Input id={id} value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} autoComplete="tel" />}</Field>
          </div>
          <div className="mt-4 flex justify-end"><Button type="submit" loading={saving} disabled={!departments.length}>Create worker</Button></div>
        </form>
      )}

      {loading ? <div className="skeleton mt-4 h-32 rounded-xl" role="status" aria-label="Loading workers" /> : items.length ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {items.map((worker) => <WorkerRow key={worker.id} worker={worker} departments={departments} onSaved={reload} />)}
          </ul>
        </div>
      ) : <p className="mt-4 rounded-xl border border-dashed border-line p-7 text-center text-sm text-ink-muted">No field-worker accounts have been created.</p>}
    </section>
  );
}

function WorkerRow({ worker, departments, onSaved }: { worker: WorkerRecord; departments: { id: string; name: string }[]; onSaved: () => Promise<void> }) {
  const [active, setActive] = useState(worker.active);
  const [departmentId, setDepartmentId] = useState(worker.departmentId);
  const [zone, setZone] = useState(worker.zone ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = active !== worker.active || departmentId !== worker.departmentId || zone !== (worker.zone ?? "");

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/workers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: worker.id, active, departmentId, zone }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't save worker changes.");
      toast.success("Worker profile updated.");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save worker changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber-accent"><UserRound className="h-4 w-4" aria-hidden /></span>
        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{worker.name} <span className="ml-1 font-mono text-[10px] font-medium text-ink-muted">{worker.employeeId}</span></span><span className="block truncate text-xs text-ink-muted">{worker.email}</span></span>
      </div>
      <span className="hidden items-center gap-1 text-xs text-ink-muted xl:inline-flex"><Users className="h-3.5 w-3.5" aria-hidden /> {worker.departmentName}</span>
      <div className="grid gap-2 sm:grid-cols-[minmax(150px,1fr)_minmax(130px,0.8fr)_auto]">
        <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} aria-label={`Department for ${worker.name}`} className="text-xs">{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select>
        <Input value={zone} onChange={(event) => setZone(event.target.value)} aria-label={`Zone for ${worker.name}`} placeholder="Zone / area" maxLength={80} className="h-9 text-xs" />
        <div className="flex items-center justify-end gap-2"><button className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? "bg-verdant-soft text-verdant" : "bg-surface-2 text-ink-muted"}`} onClick={() => setActive((value) => !value)} type="button" aria-pressed={active}>{active ? "Active" : "Inactive"}</button><Button size="sm" variant="secondary" onClick={() => void save()} loading={saving} disabled={!dirty}>Save</Button></div>
      </div>
    </li>
  );
}
