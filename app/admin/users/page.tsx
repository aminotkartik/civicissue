import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getAllDepartments } from "@/lib/queries/references";
import { listUsersForAdmin } from "@/lib/queries/users";
import { USER_ROLES, type UserRole } from "@/lib/types";
import { AdminUsersFilters, AdminUsersTable } from "@/components/admin/users-management";
import { WorkerManager } from "@/components/admin/worker-manager";

export const metadata: Metadata = { title: "Users & access", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login?next=/admin/users");
  if (actor.role !== "ADMIN") redirect("/dashboard");
  const raw = await searchParams;
  const one = (key: string) => typeof raw[key] === "string" ? raw[key] as string : "";
  const roleValue = one("role");
  const role = USER_ROLES.includes(roleValue as UserRole) ? roleValue as UserRole : undefined;
  const suspendedValue = one("suspended");
  const suspended = suspendedValue === "yes" || suspendedValue === "no" ? suspendedValue : undefined;
  const pageValue = Number(one("page") || 1);
  const page = Number.isInteger(pageValue) ? Math.max(1, Math.min(pageValue, 500)) : 1;
  const q = one("q").trim();
  const [result, allDepartments] = await Promise.all([
    listUsersForAdmin({ q, role, suspended, page, pageSize: 20 }),
    getAllDepartments(),
  ]);
  const departments = allDepartments.map(({ id, name }) => ({ id, name }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4"><Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-terra-700 hover:underline"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Admin console</Link></nav>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-terra-700"><Users className="h-4 w-4" aria-hidden /> Platform access</p><h1 className="text-2xl font-bold tracking-tight text-ink">Users & access</h1><p className="mt-1 text-sm text-ink-muted">{result.total.toLocaleString("en-IN")} accounts · manage role, department and account status.</p></div>
      </header>

      <Suspense fallback={<div className="skeleton h-12 rounded-xl" />}>
        <AdminUsersFilters role={role ?? ""} suspended={suspended ?? ""} />
      </Suspense>
      <AdminUsersTable items={result.items} total={result.total} page={page} pageSize={20} departments={departments} currentAdminId={actor.id} />
      <WorkerManager departments={departments.filter((department) => allDepartments.some((row) => row.id === department.id && row.active))} />
    </div>
  );
}
