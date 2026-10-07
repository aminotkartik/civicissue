"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Shield, ShieldOff, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatNumber } from "@/lib/utils/format";
import type { AdminUserRow } from "@/lib/queries/users";
import type { UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["CITIZEN", "AUTHORITY", "WORKER", "ADMIN"];

export function AdminUsersFilters({ role, suspended }: { role: string; suspended: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function navigate(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }
  function search(event: FormEvent) {
    event.preventDefault();
    navigate("q", q.trim());
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center">
      <form onSubmit={search} className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input value={q} onChange={(event) => setQ(event.target.value)} className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm focus:border-terra-400 focus:outline-none focus:ring-2 focus:ring-terra-200" placeholder="Search name or email…" aria-label="Search users" />
      </form>
      <Select value={role} onChange={(event) => navigate("role", event.target.value)} aria-label="Filter users by role" className="sm:w-40">
        <option value="">All roles</option>{ROLES.map((value) => <option key={value} value={value}>{value}</option>)}
      </Select>
      <Select value={suspended} onChange={(event) => navigate("suspended", event.target.value)} aria-label="Filter users by suspension" className="sm:w-40">
        <option value="">Any account status</option><option value="no">Not suspended</option><option value="yes">Suspended</option>
      </Select>
    </div>
  );
}

export function AdminUsersTable({
  items,
  total,
  page,
  pageSize,
  departments,
  currentAdminId,
}: {
  items: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  departments: { id: string; name: string }[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mt-4 space-y-3 md:hidden">
        {items.map((item) => <UserEditor key={item.id} item={item} departments={departments} self={item.id === currentAdminId} />)}
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-left">
          <caption className="sr-only">User accounts, access roles, departments and status</caption>
          <thead className="bg-surface-2 text-[10px] uppercase tracking-wide text-ink-muted"><tr><th className="px-4 py-3">Account</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Reports</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => <tr key={item.id}>
              <td className="px-4 py-3"><span className="block text-xs font-semibold text-ink">{item.name}</span><span className="mt-0.5 block text-[10px] text-ink-muted">{item.email}</span></td>
              <td className="px-3 py-3"><span className="rounded-full bg-surface-2 px-2 py-1 text-[10px] font-semibold text-ink-soft">{item.role}</span></td>
              <td className="px-3 py-3 text-xs text-ink-soft">{item.departmentName ?? "—"}</td>
              <td className="px-3 py-3 text-xs tabular-nums text-ink-soft">{formatNumber(item.reportCount)}</td>
              <td className="px-3 py-3"><AccountStatus item={item} /></td>
              <td className="whitespace-nowrap px-3 py-3 text-[11px] text-ink-muted">{formatDate(item.createdAt)}</td>
              <td className="px-3 py-3"><UserEditor item={item} departments={departments} self={item.id === currentAdminId} compact /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!items.length && <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">No accounts match these filters.</p>}
      <div className="mt-5">
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={(nextPage) => { const next = new URLSearchParams(params.toString()); next.set("page", String(nextPage)); router.push(`${pathname}?${next.toString()}`); }} />
      </div>
    </>
  );
}

function AccountStatus({ item }: { item: AdminUserRow }) {
  const state = item.isSuspended ? { label: "Suspended", cls: "bg-alert-soft text-alert" } : !item.isActive ? { label: "Inactive", cls: "bg-surface-2 text-ink-muted" } : { label: "Active", cls: "bg-verdant-soft text-verdant" };
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${state.cls}`}>{state.label}</span>;
}

function UserEditor({ item, departments, self, compact = false }: { item: AdminUserRow; departments: { id: string; name: string }[]; self: boolean; compact?: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(item.role);
  const [departmentId, setDepartmentId] = useState(item.departmentId ?? "");
  const [suspended, setSuspended] = useState(item.isSuspended);
  const [active, setActive] = useState(item.isActive);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const hasWorkerProfile = item.role === "WORKER";
  const dirty = role !== item.role || departmentId !== (item.departmentId ?? "") || suspended !== item.isSuspended || active !== item.isActive;

  async function save() {
    const body: Record<string, unknown> = { userId: item.id };
    if (role !== item.role) body.role = role;
    if (departmentId !== (item.departmentId ?? "")) body.departmentId = departmentId || null;
    if (suspended !== item.isSuspended) {
      body.isSuspended = suspended;
      if (suspended) body.suspensionReason = reason.trim() || "Administrative review";
    }
    if (active !== item.isActive) body.isActive = active;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't update this account.");
      toast.success("Account access updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update this account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "rounded-xl border border-line bg-surface p-4"}>
      {!compact && <div className="mb-3 flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-ink">{item.name}</p><p className="truncate text-[10px] text-ink-muted">{item.email}</p></div><AccountStatus item={{ ...item, role, isSuspended: suspended, isActive: active }} /></div>}
      <div className={compact ? "flex flex-wrap items-center gap-2" : "space-y-2"}>
        {compact && <Select value={role} disabled={self} onChange={(event) => setRole(event.target.value as UserRole)} aria-label={`Role for ${item.name}`} className="min-w-28 text-xs">{ROLES.map((value) => <option key={value} value={value} disabled={value === "WORKER" && !hasWorkerProfile}>{value}</option>)}</Select>}
        {(role === "AUTHORITY" || role === "WORKER") && (
          <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} disabled={self} aria-label={`Department for ${item.name}`} className="min-w-32 text-xs">
            <option value="">No department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
        )}
        {!self && (
          <div className="flex items-center gap-1.5">
            <Button variant={suspended ? "secondary" : "outline"} size="sm" onClick={() => setSuspended((value) => !value)} title={suspended ? "Restore account" : "Suspend account"}>
              {suspended ? <><Shield className="h-3 w-3" aria-hidden /> Restore</> : <><ShieldOff className="h-3 w-3" aria-hidden /> Suspend</>}
            </Button>
            <Button variant={active ? "ghost" : "success"} size="sm" onClick={() => setActive((value) => !value)} title={active ? "Deactivate account" : "Activate account"}>
              {active ? <><UserX className="h-3 w-3" aria-hidden /> Deactivate</> : <><UserCheck className="h-3 w-3" aria-hidden /> Activate</>}
            </Button>
          </div>
        )}
        {suspended && !item.isSuspended && <input className="h-8 w-full rounded-lg border border-line px-2 text-xs" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Suspension reason (optional)" maxLength={300} aria-label={`Suspension reason for ${item.name}`} />}
        <div className={compact ? "ml-auto" : "flex justify-end"}><Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty || self}>Save</Button></div>
      </div>
      {!compact && <p className="mt-3 text-[10px] text-ink-muted">{formatNumber(item.reportCount)} reports · trust {item.trustScore} · joined {formatDate(item.createdAt)}</p>}
    </div>
  );
}
