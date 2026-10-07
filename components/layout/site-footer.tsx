import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "About", href: "/about" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Explore issues", href: "/issues" },
      { label: "Issue map", href: "/map" },
      { label: "Community", href: "/community" },
      { label: "Resolved gallery", href: "/resolved" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login", href: "/login" },
      { label: "Register", href: "/register" },
      { label: "My reports", href: "/my-reports" },
      { label: "Notifications", href: "/notifications" },
      { label: "Profile", href: "/profile" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Accessibility", href: "/accessibility" },
      { label: "Report abuse", href: "/report-abuse" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo size="sm" />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-muted">
              A transparent civic reporting platform connecting citizens,
              municipal authorities and field teams — from report to resolution.
            </p>
            <p className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
              <strong>Disclaimer:</strong> CivicIssue is a reporting platform and
              does not itself guarantee government action. For emergencies,
              contact your local emergency services. AI suggestions may be
              incorrect and are always reviewed by humans.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-[13px] text-ink-muted hover:text-terra-600">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row">
          <p>© {new Date().getFullYear()} CivicIssue. Built as a civic-technology demonstration platform.</p>
          <p>Report it. Track it. Resolve it.</p>
        </div>
      </div>
    </footer>
  );
}
