import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", description: "How CivicIssue handles account, report, location and notification data." };

export default function PrivacyPage() {
  return (
    <article className="prose-civic mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-terra-700">CivicIssue policy</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Privacy notice</h1>
      <p className="mt-3 text-sm text-ink-muted">Last updated: 7 October 2026</p>
      <div className="mt-7 space-y-7 text-sm leading-relaxed text-ink-soft">
        <section><h2 className="text-lg font-bold text-ink">Information you provide</h2><p className="mt-2">An account stores information such as your name, email address, optional phone number, city and locality. Reports may include descriptions, photos, issue categories, submitted location, comments, community confirmations and feedback. Staff actions and status changes are recorded in an audit trail so reports can be followed responsibly.</p></section>
        <section><h2 className="text-lg font-bold text-ink">Location choices</h2><p className="mt-2">The report form lets you choose whether a report location is published exactly or approximately. Approximate locations are obscured for public map and list views; authorized staff may need more precise coordinates to investigate. The nearby-report finder can use your device location after you choose the location control. That browser permission is optional, and the coordinates are sent to the nearby search endpoint to calculate results rather than saved to your profile.</p></section>
        <section><h2 className="text-lg font-bold text-ink">Public information</h2><p className="mt-2">Public reports, their status timelines, public comments and resolution evidence may be visible to other visitors. Do not include passwords, financial information, private contact details or other sensitive personal information in a public report or comment. Reporters can set approximate location privacy; hiding a report from public view is also available to authorized moderators.</p></section>
        <section><h2 className="text-lg font-bold text-ink">Security and storage</h2><p className="mt-2">Passwords are stored as password hashes, not readable passwords. Sign-in sessions use a signed, HTTP-only cookie. Report images are stored through the configured storage provider. A local development or demo installation may use local files and a local database; a deployed installation may use managed services configured by its operator. No platform can guarantee absolute security, so avoid submitting information you would not want included in a civic record.</p></section>
        <section><h2 className="text-lg font-bold text-ink">AI and notifications</h2><p className="mt-2">When enabled by the operator, issue text or images may be sent to the configured AI provider to generate suggestions. AI results are advisory and may be inaccurate. If no provider is configured, deterministic local rules are used. In-app notification preferences are available in your profile; email notifications depend on the operator&apos;s email configuration.</p></section>
        <section><h2 className="text-lg font-bold text-ink">Questions or corrections</h2><p className="mt-2">For report-related corrections, use the issue page or contact the department shown there. For account or platform questions, contact the site operator using the configured department directory on the <a href="/contact" className="font-semibold text-terra-700 underline">contact page</a>.</p></section>
      </div>
    </article>
  );
}
