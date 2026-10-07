"use client";

import { cn } from "@/lib/utils/format";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn("flex gap-1 overflow-x-auto no-scrollbar rounded-xl bg-surface-2 p-1", className)}
    >
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={value === item.key}
          tabIndex={value === item.key ? 0 : -1}
          onClick={() => onChange(item.key)}
          className={cn(
            "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
            value === item.key
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-muted hover:text-ink"
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={cn("ml-1.5 text-xs", value === item.key ? "text-terra-600" : "text-ink-muted")}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
