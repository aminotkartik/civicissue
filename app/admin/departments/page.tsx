import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getAllDepartments, getWorkersWithLoad } from "@/lib/queries/references";
import { DepartmentManager } from "@/components/admin/department-manager";

export const metadata: Metadata = { title: "Departments", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminDepartmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/departments");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const [departments, workers] = await Promise.all([getAllDepartments(), getWorkersWithLoad()]);
  const items = departments.map((department) => ({
    id: department.id,
    name: department.name,
    description: department.description,
    contactEmail: department.contactEmail,
    contactPhone: department.contactPhone,
    zones: department.zones,
    active: department.active,
    workerCount: workers.filter((worker) => worker.departmentId === department.id && worker.active).length,
  }));
  const activeCount = items.filter((department) => department.active).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4"><Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-terra-700 hover:underline"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Admin console</Link></nav>
      <header className="mb-6"><h1 className="text-2xl font-bold tracking-tight text-ink">Departments & service zones</h1><p className="mt-1 text-sm text-ink-muted">{activeCount} active of {items.length} departments · routing, contact and worker information.</p></header>
      <DepartmentManager departments={items} />
    </div>
  );
}
