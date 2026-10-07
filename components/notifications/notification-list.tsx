"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Bell, Check, CheckCheck, CheckCircle2, FileText, MessageCircle, RotateCcw, Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils/format";

export interface NotificationItemData {
  id: string;
  type: string;
  title: string;
  message: string;
  issueId: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: Date | string;
}

const ICONS: Record<string, typeof Bell> = {
  ISSUE_SUBMITTED: FileText,
  ISSUE_VERIFIED: CheckCircle2,
  ISSUE_RESOLVED: CheckCircle2,
  ISSUE_REJECTED: AlertTriangle,
  WORKER_ASSIGNED: Wrench,
  STATUS_CHANGED: RotateCcw,
  INFO_REQUESTED: MessageCircle,
  COMMENT_REPLY: MessageCircle,
  ESCALATION: AlertTriangle,
  FEEDBACK_REQUEST: CheckCircle2,
};

export function NotificationList({ initialItems, initialUnread }: { initialItems: NotificationItemData[]; initialUnread: number }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [mode, setMode] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState(false);

  const visible = mode === "unread" ? items.filter((item) => !item.isRead) : items;

  async function markRead(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.isRead) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read: true }),
      });
      if (!response.ok) throw new Error("Couldn't update this notification.");
      setItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, isRead: true } : candidate));
      setUnread((count) => Math.max(0, count - 1));
    } catch {
      toast.error("Couldn't update this notification. Please try again.");
    }
  }

  async function markAllRead() {
    if (!unread || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!response.ok) throw new Error("Couldn't mark notifications as read.");
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnread(0);
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("Couldn't mark notifications as read.");
    } finally {
      setBusy(false);
    }
  }

  async function openNotification(item: NotificationItemData) {
    await markRead(item.id);
    const destination = item.link?.startsWith("/") ? item.link : item.issueId ? `/issues/${item.issueId}` : "/notifications";
    router.push(destination);
  }

  return (
    <section aria-label="Notifications">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="Notification filter">
          <button onClick={() => setMode("all")} aria-pressed={mode === "all"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "all" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"}`}>All ({items.length})</button>
          <button onClick={() => setMode("unread")} aria-pressed={mode === "unread"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "unread" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"}`}>Unread ({unread})</button>
        </div>
        <Button variant="outline" size="sm" disabled={!unread || busy} loading={busy} onClick={() => void markAllRead()}>
          <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<Bell className="h-6 w-6" aria-hidden />}
          title={mode === "unread" ? "You're all caught up" : "No notifications yet"}
          message={mode === "unread" ? "New updates about your reports and followed issues will appear here." : "When something changes on your reports or followed issues, we'll let you know here."}
        />
      ) : (
        <ol className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {visible.map((item) => {
            const Icon = ICONS[item.type] ?? Bell;
            return (
              <li key={item.id} className={item.isRead ? "" : "bg-terra-50/40"}>
                <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.isRead ? "bg-surface-2 text-ink-muted" : "bg-terra-50 text-terra-700"}`}><Icon className="h-4 w-4" aria-hidden /></span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => void openNotification(item)}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{item.title}</span>
                      {!item.isRead && <span className="rounded-full bg-terra-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">New</span>}
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-ink-soft">{item.message}</span>
                    <span className="mt-1.5 block text-[11px] text-ink-muted">{formatDateTime(item.createdAt)}</span>
                  </button>
                  {item.isRead ? (
                    <span className="sr-only">Read</span>
                  ) : (
                    <button className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-terra-700" onClick={() => void markRead(item.id)} aria-label={`Mark ${item.title} as read`} title="Mark as read">
                      <Check className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {items.length >= 60 && <p className="mt-3 text-center text-xs text-ink-muted">Showing the 60 most recent notifications.</p>}
    </section>
  );
}
