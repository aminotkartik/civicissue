import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export function Card({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return (
    <As className={cn("rounded-card border border-line bg-surface shadow-card", className)}>
      {children}
    </As>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>{children}</div>;
}

export function CardTitle({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <h3 id={id} className={cn("text-[15px] font-semibold text-ink", className)}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
