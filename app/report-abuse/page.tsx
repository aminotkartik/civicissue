import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ReportAbuseForm } from "@/components/forms/report-abuse-form";

export const metadata: Metadata = { title: "Report inappropriate content", robots: { index: false } };

export default async function ReportAbusePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const paramsPromise: Promise<Record<string, string | string[] | undefined>> = searchParams ?? Promise.resolve({});
  const [user, params] = await Promise.all([getCurrentUser().catch(() => null), paramsPromise]);
  const requestedType = typeof params.entityType === "string" ? params.entityType : "ISSUE";
  const initialType = ["ISSUE", "COMMENT", "USER"].includes(requestedType) ? requestedType as "ISSUE" | "COMMENT" | "USER" : "ISSUE";
  const initialId = typeof params.entityId === "string" ? params.entityId : "";
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-alert">Content moderation</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Report inappropriate content</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">Please report content that appears abusive, spammy, fraudulent or to expose private information. Reports are reviewed by authorized moderators; submission does not automatically remove content.</p>
      {user ? (
        <div className="mt-6"><ReportAbuseForm initialType={initialType} initialId={initialId} /></div>
      ) : (
        <div className="mt-6 rounded-xl border border-line bg-surface p-5"><p className="text-sm text-ink-soft">Sign in to submit a moderation report. Issue pages also have a direct “Report inappropriate content” action.</p><Link href={`/login?next=${encodeURIComponent(`/report-abuse?entityType=${initialType}&entityId=${initialId}`)}`} className="mt-4 inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-canvas hover:bg-ink/90">Sign in</Link></div>
      )}
    </div>
  );
}
