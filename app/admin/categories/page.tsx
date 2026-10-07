import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getAllCategories, getActiveDepartments } from "@/lib/queries/references";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Categories & SLA", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/categories");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const [categories, departments] = await Promise.all([getAllCategories(), getActiveDepartments()]);
  const items = categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    defaultDepartmentId: category.defaultDepartmentId,
    slaCriticalHours: category.slaCriticalHours,
    slaHighHours: category.slaHighHours,
    slaMediumHours: category.slaMediumHours,
    slaLowHours: category.slaLowHours,
    active: category.active,
  }));
  const active = items.filter((category) => category.active).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4"><Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-terra-700 hover:underline"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Admin console</Link></nav>
      <header className="mb-6"><p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-terra-700"><Tags className="h-4 w-4" aria-hidden /> Report configuration</p><h1 className="text-2xl font-bold tracking-tight text-ink">Categories & service targets</h1><p className="mt-1 text-sm text-ink-muted">{active} active of {items.length} categories · route reports to a department and configure severity-based SLA hours.</p></header>
      <CategoryManager categories={items} departments={departments.map(({ id, name }) => ({ id, name }))} />
    </div>
  );
}
