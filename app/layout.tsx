import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notifications } from "@/drizzle/sqlite/schema";
import { and, eq, sql } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileNav } from "@/components/layout/mobile-nav";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "CivicIssue — Report it. Track it. Resolve it.",
    template: "%s · CivicIssue",
  },
  description:
    "Report potholes, broken streetlights, garbage, drainage issues and other civic problems. Track every update from submission to resolution.",
  keywords: ["civic issues", "pothole reporting", "municipal complaints", "city services", "civic tech"],
  openGraph: {
    title: "CivicIssue — Report it. Track it. Resolve it.",
    description:
      "A transparent civic issue reporting and resolution platform for citizens, authorities and field workers.",
    type: "website",
    siteName: "CivicIssue",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon-512.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#bf4726",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser().catch(() => null);
  let unread = 0;
  if (user) {
    try {
      const db = await getDb();
      const rows = await db
        .select({ n: sql<number>`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
      unread = rows[0]?.n ?? 0;
    } catch {
      unread = 0;
    }
  }

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-canvas text-ink antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[1200] focus:rounded-lg focus:bg-terra-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to main content
        </a>
        <SiteHeader
          user={
            user
              ? { id: user.id, name: user.name, email: user.email, role: user.role, profileImage: user.profileImage }
              : null
          }
          unreadCount={unread}
        />
        <main id="main-content" className="flex-1 pb-16 sm:pb-0">
          {children}
        </main>
        <SiteFooter />
        <MobileNav isAuthenticated={!!user} />
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: { background: "#ffffff", border: "1px solid #e7dfd2", color: "#26221d" },
          }}
        />
      </body>
    </html>
  );
}
