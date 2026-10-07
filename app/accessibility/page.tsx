import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, Map } from "lucide-react";

export const metadata: Metadata = { title: "Accessibility", description: "Accessibility features and alternatives in CivicIssue." };

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-terra-700"><Accessibility className="h-4 w-4" aria-hidden /> Inclusive access</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Accessibility</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">CivicIssue is designed to work with keyboard navigation, visible focus indicators, semantic page headings, form labels and responsive layouts. Status is communicated with text and icons as well as colour.</p>
      <section className="mt-7 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-bold text-ink">Maps have a list alternative</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Interactive maps can be difficult to use with assistive technology. The issue map and nearby reports also expose linked report lists, with status, priority, category and location labels.</p>
        <Link href="/issues" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-terra-700 hover:underline"><Map className="h-4 w-4" aria-hidden /> Browse issues as a list</Link>
      </section>
      <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-bold text-ink">Need another way to report?</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Location search and manual map-pin placement are available alongside browser geolocation. Geolocation is optional. If an interaction is inaccessible or prevents you from completing a report, contact the site operator using the directory on our <Link href="/contact" className="font-semibold text-terra-700 underline">contact page</Link>.</p>
      </section>
      <p className="mt-6 text-xs leading-relaxed text-ink-muted">Accessibility is an ongoing effort. The browser, device, assistive technology and external OpenStreetMap tiles can affect the experience, so please report any barriers you encounter.</p>
    </div>
  );
}
