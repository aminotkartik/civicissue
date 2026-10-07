import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq, sql, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notifications } from "@/drizzle/sqlite/schema";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/notifications");
  const db = await getDb();
  const [items, unreadRows] = await Promise.all([
    db.select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      issueId: notifications.issueId,
      link: notifications.link,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    }).from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(60),
    db.select({ n: sql<number>`count(*)` }).from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-terra-700">Your civic activity</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Notifications</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Status changes, requests for information and community updates — all in one place.</p>
      </header>
      <NotificationList initialItems={items} initialUnread={unreadRows[0]?.n ?? 0} />
    </div>
  );
}
