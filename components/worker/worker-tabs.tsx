"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

const GROUPS = {
  active: "ASSIGNED,IN_PROGRESS,REOPENED,ESCALATED",
  assigned: "ASSIGNED",
  inProgress: "IN_PROGRESS",
  completed: "RESOLVED,CLOSED",
  all: "",
} as const;

export function WorkerTabs({ counts }: { counts: Record<keyof typeof GROUPS, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = Object.entries(GROUPS).find(([, value]) => (params.get("statuses") ?? "") === value)?.[0] ?? "active";
  return (
    <Tabs
      value={selected}
      items={[
        { key: "active", label: "Active jobs", count: counts.active },
        { key: "assigned", label: "Newly assigned", count: counts.assigned },
        { key: "inProgress", label: "In progress", count: counts.inProgress },
        { key: "completed", label: "Completed", count: counts.completed },
        { key: "all", label: "All", count: counts.all },
      ]}
      onChange={(key) => {
        const next = new URLSearchParams(params.toString());
        const statuses = GROUPS[key as keyof typeof GROUPS];
        if (statuses) next.set("statuses", statuses);
        else next.delete("statuses");
        next.delete("status");
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    />
  );
}
