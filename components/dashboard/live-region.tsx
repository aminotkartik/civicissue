"use client";

/**
 * Near-real-time refresh (spec §74 polling fallback): quietly checks for
 * account-level changes and refreshes server data when the tab regains focus
 * or every 45 seconds while visible.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveRegion() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const onFocus = () => {
      if (Date.now() - last > 15_000) {
        last = Date.now();
        router.refresh();
      }
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        last = Date.now();
        router.refresh();
      }
    }, 45_000);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [router]);
  return null;
}
