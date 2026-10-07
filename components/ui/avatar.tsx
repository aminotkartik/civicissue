import { cn, initials } from "@/lib/utils/format";

const ROLE_COLORS: Record<string, string> = {
  CITIZEN: "bg-info-soft text-info",
  AUTHORITY: "bg-terra-100 text-terra-700",
  WORKER: "bg-amber-soft text-amber-accent",
  ADMIN: "bg-active-soft text-active",
};

export function Avatar({
  name,
  src,
  role,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  role?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-14 w-14 text-base" : "h-9 w-9 text-xs";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn(dims, "rounded-full object-cover border border-line", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        dims,
        "inline-flex items-center justify-center rounded-full font-semibold border border-line",
        role ? ROLE_COLORS[role] ?? "bg-surface-2 text-ink-soft" : "bg-surface-2 text-ink-soft",
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
