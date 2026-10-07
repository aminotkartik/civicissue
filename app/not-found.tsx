import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <Logo href={null} size="lg" withText={false} />
      <span className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-info-soft text-info">
        <Compass className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-bold text-ink">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        The page you were looking for may have been moved, or the complaint ID
        may be incorrect.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="h-10 rounded-lg bg-terra-600 px-5 text-sm font-semibold text-white leading-10 hover:bg-terra-700">
          Back home
        </Link>
        <Link href="/issues" className="h-10 rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-ink-soft leading-10 hover:bg-surface-2">
          Explore issues
        </Link>
      </div>
    </div>
  );
}
