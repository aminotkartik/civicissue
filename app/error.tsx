"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/** Application-level error boundary (spec §128). */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured client-side error visibility; wire to Sentry/etc. in production.
    console.error("[civicissue:ui] section error:", error.message, error.digest);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-alert-soft text-alert">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-lg font-bold text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        We couldn&apos;t load this section. Your data is safe — please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 h-10 rounded-lg bg-terra-600 px-5 text-sm font-semibold text-white hover:bg-terra-700"
      >
        Try again
      </button>
    </div>
  );
}
