import Link from "next/link";
import { cn } from "@/lib/utils/format";

/**
 * CivicIssue logo — a map pin containing a city skyline with a check mark:
 * location + civic infrastructure + resolution.
 */
export function Logo({ href = "/", className, withText = true, size = "md" }: { href?: string | null; className?: string; withText?: boolean; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const mark = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 48 48" className={cn(dims, "shrink-0")} aria-hidden>
        <path
          d="M24 3C15.2 3 8 10.1 8 18.9c0 11.2 14.2 25 15.3 26 .4.4 1 .4 1.4 0C25.8 43.9 40 30.1 40 18.9 40 10.1 32.8 3 24 3Z"
          fill="#bf4726"
        />
        <path d="M24 6.2c-7 0-12.8 5.7-12.8 12.7 0 3.3 1.5 7 3.8 10.6l3-6.1h3.1l2.6-4.2 3 6.4 2.4-2.2h3.4l2.9 5.6c2.2-3.5 3.6-7 3.6-10.1 0-7-5.8-12.7-12.9-12.7Z" fill="#fdf3ef" opacity="0.92"/>
        <rect x="17.5" y="14.5" width="3.4" height="7" rx="0.6" fill="#bf4726"/>
        <rect x="22.3" y="11.5" width="4" height="10" rx="0.6" fill="#bf4726"/>
        <rect x="27.7" y="15.5" width="3.4" height="6" rx="0.6" fill="#bf4726"/>
        <path
          d="M18.6 28.4l3.8 3.9 7.6-8.4"
          fill="none"
          stroke="#4d8a5b"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withText && (
        <span className="flex flex-col leading-none">
          <span className={cn("font-bold tracking-tight text-ink", size === "lg" ? "text-xl" : size === "sm" ? "text-[15px]" : "text-[17px]")}>
            Civic<span className="text-terra-600">Issue</span>
          </span>
          {size !== "sm" && (
            <span className="mt-0.5 hidden text-[10px] font-medium text-ink-muted sm:block">
              Report it. Track it. Resolve it.
            </span>
          )}
        </span>
      )}
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} aria-label="CivicIssue home" className="rounded-lg">
      {mark}
    </Link>
  );
}
