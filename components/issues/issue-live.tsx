"use client";

/**
 * Live-refresh watcher for the issue page (spec §125): polls the freshness
 * endpoint and re-renders server data when something changed.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function IssueLive({
  publicId,
  initialUpdatedAt,
  enabled = true,
  intervalMs = 30_000,
}: {
  publicId: string;
  initialUpdatedAt: number;
  enabled?: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const lastSeen = useRef(initialUpdatedAt);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/issues/${publicId}/freshness`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: { updatedAt: number; status: string };
        };
        if (stopped || !data.data) return;
        if (data.data.updatedAt > lastSeen.current) {
          lastSeen.current = data.data.updatedAt;
          toast.info("This issue was just updated.", { duration: 3500 });
          router.refresh();
        }
      } catch {
        /* offline — ignore */
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(poll, intervalMs);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [publicId, enabled, intervalMs, router]);

  return null;
}
