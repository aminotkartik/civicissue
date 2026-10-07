import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { BadgeCheck, Eye, MapPin, Users } from "lucide-react";

/**
 * Split-screen shell for all auth pages: form on the left, brand story right.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-stretch gap-0 px-0 sm:px-6 lg:grid-cols-2 lg:py-10">
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size="sm" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>
      <div className="relative hidden overflow-hidden rounded-l-3xl border-y border-l border-line bg-ink lg:block">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 75% 15%, #d35a34 0, transparent 45%), radial-gradient(circle at 20% 80%, #4d8a5b 0, transparent 40%)",
          }}
          aria-hidden
        />
        <div className="relative flex h-full flex-col justify-center gap-8 p-12">
          <Logo href={null} size="lg" className="[&_span]:text-canvas [&_.text-terra-600]:text-terra-300 [&_.text-ink-muted]:text-canvas/60" />
          <blockquote className="border-l-2 border-terra-400 pl-5 text-[15px] leading-relaxed text-canvas/85">
            “Every complaint has a status, a responsible department, an update
            history and a resolution record. That is what makes a city
            accountable to the people who live in it.”
          </blockquote>
          <ul className="space-y-4">
            {[
              { icon: MapPin, text: "Pin the exact spot — or keep it approximate for privacy." },
              { icon: Eye, text: "Track verification, assignment, repairs and resolution evidence." },
              { icon: Users, text: "Support neighbours' reports and confirm issues on the ground." },
              { icon: BadgeCheck, text: "Rate the resolution. Reopen it if the problem returns." },
            ].map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-[13px] leading-relaxed text-canvas/75">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas/10 text-terra-300">
                  <f.icon className="h-4 w-4" aria-hidden />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
