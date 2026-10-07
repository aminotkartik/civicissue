import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { getActiveDepartments } from "@/lib/queries/references";

export const metadata: Metadata = { title: "Contact", description: "Find contact details for the departments responsible for CivicIssue reports." };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const departments = await getActiveDepartments();
  const withContacts = departments.filter((department) => department.contactEmail || department.contactPhone);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-terra-700">Get in touch</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Contact the responsible team</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">For an existing report, open its issue page to see the assigned department and latest status. Department contact details appear here when the site administrator has configured them.</p>

      {withContacts.length ? (
        <ul className="mt-7 grid gap-4 sm:grid-cols-2">
          {withContacts.map((department) => <li key={department.id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h2 className="text-base font-bold text-ink">{department.name}</h2>
            {department.description && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{department.description}</p>}
            {department.zones && <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terra-600" aria-hidden />Service zones: {department.zones}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {department.contactEmail && <a href={`mailto:${department.contactEmail}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink-soft hover:bg-surface-2"><Mail className="h-3.5 w-3.5" aria-hidden /> Email department</a>}
              {department.contactPhone && <a href={`tel:${department.contactPhone.replace(/[^+\d]/g, "")}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink-soft hover:bg-surface-2"><Phone className="h-3.5 w-3.5" aria-hidden /> {department.contactPhone}</a>}
            </div>
          </li>)}
        </ul>
      ) : (
        <div className="mt-7 rounded-2xl border border-dashed border-line bg-surface p-6 text-center"><ShieldAlert className="mx-auto h-7 w-7 text-amber-accent" aria-hidden /><h2 className="mt-3 text-base font-bold text-ink">Department contacts aren&apos;t configured</h2><p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-ink-muted">The site administrator has not added public email or phone details yet. You can still browse public reports or submit a report through the platform.</p></div>
      )}

      <div className="mt-6 flex flex-wrap gap-3"><Link href="/issues" className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-canvas hover:bg-ink/90">Browse existing reports</Link><Link href="/report" className="inline-flex h-10 items-center rounded-lg bg-terra-600 px-4 text-sm font-semibold text-white hover:bg-terra-700">Start a report</Link></div>
      <p className="mt-5 text-xs text-ink-muted">CivicIssue is a reporting platform and does not provide emergency response. For urgent danger, contact the appropriate local emergency service.</p>
    </div>
  );
}
