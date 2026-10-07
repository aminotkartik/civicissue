import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, HardHat, MapPin, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "About CivicIssue",
  description: "How CivicIssue connects residents, municipal teams and field workers to report, track and resolve local issues.",
};

const STEPS = [
  { icon: MapPin, title: "Report with context", text: "Describe what happened, choose a category, add a photo and place a pin. The report wizard can suggest a category and highlight possible duplicates; a person always makes the final call." },
  { icon: ShieldCheck, title: "Route and review", text: "Reports move through a recorded lifecycle. Department-scoped authority staff verify details, request information and assign work to a field team." },
  { icon: HardHat, title: "Work in the field", text: "Workers can start a job, post progress and attach evidence. Higher-risk resolutions require an after photo before they can be closed out." },
  { icon: Eye, title: "Follow the outcome", text: "Citizens can follow, support and confirm reports, see the public timeline and share feedback after a resolution." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-terra-700">About CivicIssue</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">A clearer path from a local problem to a documented response.</h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">CivicIssue is a civic reporting and coordination platform. It gives residents a structured way to describe public-space problems and gives departments a shared, auditable workflow to review and act on those reports.</p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="How CivicIssue works">
        {STEPS.map(({ icon: Icon, title, text }, index) => <article key={title} className="rounded-2xl border border-line bg-surface p-5 shadow-card"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-terra-50 text-terra-700"><Icon className="h-5 w-5" aria-hidden /></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Step {index + 1}</p><h2 className="text-base font-bold text-ink">{title}</h2></div></div><p className="mt-3 text-sm leading-relaxed text-ink-soft">{text}</p></article>)}
      </section>

      <section className="mt-10 rounded-2xl border border-amber-accent/20 bg-amber-soft/55 p-5 sm:p-6">
        <h2 className="text-base font-bold text-ink">Built for transparency, not promises</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">A submitted report is not a guarantee of government action or a substitute for emergency services. Status history, deadlines, department assignment and resolution evidence help make the workflow visible; decisions and service delivery remain the responsibility of the relevant authority.</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Automated suggestions are explainable assistance, not decisions. AI classifications and priority recommendations can be wrong, and the platform uses deterministic fallback behavior when no AI provider is configured.</p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3"><Link href="/issues" className="inline-flex h-11 items-center gap-2 rounded-lg bg-terra-600 px-5 text-sm font-semibold text-white hover:bg-terra-700">Explore reports <ArrowRight className="h-4 w-4" aria-hidden /></Link><Link href="/report" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-surface-2"><CheckCircle2 className="h-4 w-4" aria-hidden /> Start a report</Link></div>
    </div>
  );
}
