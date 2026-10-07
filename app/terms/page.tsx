import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of use", description: "Terms for using CivicIssue civic reporting and coordination tools." };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-terra-700">CivicIssue policy</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Terms of use</h1>
      <p className="mt-3 text-sm text-ink-muted">Last updated: 7 October 2026</p>
      <div className="mt-7 space-y-7 text-sm leading-relaxed text-ink-soft">
        <section><h2 className="text-lg font-bold text-ink">Use the service responsibly</h2><p className="mt-2">Provide information that is accurate to the best of your knowledge. Do not use CivicIssue to harass people, publish private information, impersonate a resident or official, submit knowingly false reports, upload unlawful material, or disrupt the service. Respectful, relevant comments help staff and neighbours understand the issue.</p></section>
        <section><h2 className="text-lg font-bold text-ink">Public reports and moderation</h2><p className="mt-2">Reports marked public may be visible to visitors and may be shared with the responsible authority. Authorized moderators can hide content reported as abusive or misleading. A moderation report is a request for review, not a finding that the content violated these terms.</p></section>
        <section><h2 className="text-lg font-bold text-ink">No guarantee of resolution</h2><p className="mt-2">CivicIssue provides reporting, workflow and transparency tools; it does not itself provide municipal services or guarantee that an authority will accept, investigate or resolve a report by a particular date. Displayed service targets are operational targets, not an assurance of a legal remedy or service outcome.</p></section>
        <section><h2 className="text-lg font-bold text-ink">Automated assistance</h2><p className="mt-2">Category, duplicate and priority suggestions may use automated rules or an AI provider. They can be incomplete or incorrect. Staff and users should review them rather than treating them as a factual determination.</p></section>
        <section><h2 className="text-lg font-bold text-ink">Availability and changes</h2><p className="mt-2">The site operator may update, suspend or remove features to maintain the service, address security issues or comply with applicable rules. Demo or self-hosted instances are administered by their respective operators; contact the relevant operator about an account or report.</p></section>
      </div>
    </article>
  );
}
