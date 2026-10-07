import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { BadgeCheck, CheckCircle2, FileText, MessageCircle, ThumbsUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/drizzle/sqlite/schema";
import { contributionBadges, getUserPublicStats } from "@/lib/queries/users";
import { ProfileSettingsForm, PasswordChangeForm } from "@/components/forms/profile-settings";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Profile & settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?next=/profile");
  const db = await getDb();
  const [rows, stats] = await Promise.all([
    db.select({
      bio: users.bio,
      passwordHash: users.passwordHash,
      prefEmail: users.prefEmail,
      prefInApp: users.prefInApp,
      prefStatusUpdates: users.prefStatusUpdates,
      prefResolution: users.prefResolution,
      prefCommunity: users.prefCommunity,
    }).from(users).where(eq(users.id, current.id)).limit(1),
    getUserPublicStats(current.id),
  ]);
  const profile = rows[0];
  if (!profile) redirect("/login");
  const badges = contributionBadges(stats);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Profile & settings</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Keep your contact details and notification preferences up to date.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <Avatar name={current.name} src={current.profileImage} role={current.role} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-ink">{current.name}</h2>
                <p className="truncate text-xs text-ink-muted">{current.email}</p>
                <span className="mt-1 inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{current.role}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-muted">Member since {formatDate(current.createdAt)}{current.locality ? ` · ${current.locality}` : ""}{current.city ? `, ${current.city}` : ""}</p>
            {profile.bio && <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink-soft">{profile.bio}</p>}
            <div className="mt-4 rounded-xl bg-verdant-soft/50 p-3">
              <p className="text-xs font-bold text-verdant">Community trust score</p>
              <p className="mt-1 text-2xl font-bold text-ink">{formatNumber(current.trustScore)}<span className="ml-1 text-xs font-medium text-ink-muted">points</span></p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">A non-punitive signal reflecting helpful community participation.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" aria-labelledby="contribution-title">
            <h2 id="contribution-title" className="text-sm font-bold text-ink">Your contributions</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Contribution icon={<FileText className="h-3.5 w-3.5" aria-hidden />} label="Reports" value={stats.reports} />
              <Contribution icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />} label="Resolved" value={stats.resolvedReports} />
              <Contribution icon={<ThumbsUp className="h-3.5 w-3.5" aria-hidden />} label="Upvotes" value={stats.upvotes} />
              <Contribution icon={<MessageCircle className="h-3.5 w-3.5" aria-hidden />} label="Comments" value={stats.comments} />
            </div>
            {badges.length > 0 ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Community badges</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {badges.map((badge) => <li key={badge} className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2.5 py-1 text-[10px] font-semibold text-amber-accent"><BadgeCheck className="h-3 w-3" aria-hidden />{badge}</li>)}
                </ul>
              </div>
            ) : <p className="mt-3 text-xs text-ink-muted">Participate by reporting issues, supporting neighbours and confirming completed work.</p>}
          </section>
        </aside>

        <div className="space-y-5">
          <ProfileSettingsForm initial={{
            name: current.name,
            phone: current.phone ?? "",
            city: current.city ?? "",
            locality: current.locality ?? "",
            bio: profile.bio ?? "",
            prefEmail: profile.prefEmail,
            prefInApp: profile.prefInApp,
            prefStatusUpdates: profile.prefStatusUpdates,
            prefResolution: profile.prefResolution,
            prefCommunity: profile.prefCommunity,
          }} />
          <PasswordChangeForm hasPassword={!!profile.passwordHash} />
        </div>
      </div>
    </div>
  );
}

function Contribution({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-xl bg-surface-2/70 p-3"><div className="flex items-center gap-1.5 text-ink-muted">{icon}<span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span></div><p className="mt-1 text-lg font-bold text-ink">{formatNumber(value)}</p></div>;
}
