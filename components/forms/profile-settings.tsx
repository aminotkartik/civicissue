"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Bell, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

type ProfileValues = {
  name: string;
  phone: string;
  city: string;
  locality: string;
  bio: string;
  prefEmail: boolean;
  prefInApp: boolean;
  prefStatusUpdates: boolean;
  prefResolution: boolean;
  prefCommunity: boolean;
};

export function ProfileSettingsForm({ initial }: { initial: ProfileValues }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          phone: values.phone.trim() || null,
          city: values.city.trim() || null,
          locality: values.locality.trim() || null,
          bio: values.bio.trim() || null,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't save your profile.");
      toast.success("Profile and notification preferences updated.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't save your profile. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-terra-50 text-terra-700"><ShieldCheck className="h-4 w-4" aria-hidden /></span>
        <div><h2 className="text-base font-bold text-ink">Personal details</h2><p className="text-xs text-ink-muted">Manage your public name and neighbourhood details.</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>{(id) => <Input id={id} value={values.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" maxLength={120} required />}</Field>
        <Field label="Phone number" optional hint="Only used if your local authority needs to clarify a report.">{(id) => <Input id={id} value={values.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" maxLength={20} />}</Field>
        <Field label="City" optional>{(id) => <Input id={id} value={values.city} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" maxLength={120} />}</Field>
        <Field label="Locality / neighbourhood" optional>{(id) => <Input id={id} value={values.locality} onChange={(event) => update("locality", event.target.value)} autoComplete="address-level3" maxLength={160} />}</Field>
        <Field label="About you" optional hint="A short note for your public contribution profile." className="sm:col-span-2">{(id) => <Textarea id={id} value={values.bio} onChange={(event) => update("bio", event.target.value)} maxLength={400} rows={3} placeholder="Share a little about your community involvement…" />}</Field>
      </div>

      <div className="mt-7 border-t border-line pt-5">
        <div className="mb-3 flex items-center gap-2"><Bell className="h-4 w-4 text-terra-700" aria-hidden /><h3 className="text-sm font-bold text-ink">Notification preferences</h3></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Preference checked={values.prefInApp} onChange={(v) => update("prefInApp", v)} title="In-app notifications" description="Show updates in your CivicIssue inbox." />
          <Preference checked={values.prefEmail} onChange={(v) => update("prefEmail", v)} title="Email notifications" description="Email is optional and may not be configured in demo mode." />
          <Preference checked={values.prefStatusUpdates} onChange={(v) => update("prefStatusUpdates", v)} title="Report status changes" description="Review, assignment, progress and closure." />
          <Preference checked={values.prefResolution} onChange={(v) => update("prefResolution", v)} title="Resolution and feedback requests" description="Let us know whether the fix worked." />
          <Preference checked={values.prefCommunity} onChange={(v) => update("prefCommunity", v)} title="Community activity" description="Updates on issues you follow or support." />
        </div>
      </div>
      {error && <p className="mt-4 rounded-lg bg-alert-soft px-3 py-2 text-xs font-medium text-alert" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end"><Button type="submit" loading={saving}><Save className="h-4 w-4" aria-hidden /> Save changes</Button></div>
    </form>
  );
}

function Preference({ checked, onChange, title, description }: { checked: boolean; onChange: (checked: boolean) => void; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3 py-3 hover:bg-surface-2/60">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-terra-600 focus:ring-terra-500" />
      <span><span className="block text-xs font-semibold text-ink">{title}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">{description}</span></span>
    </label>
  );
}

export function PasswordChangeForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't change your password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      toast.success("Password changed successfully.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't change your password. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-ink-soft"><LockKeyhole className="h-4 w-4" aria-hidden /></span>
        <div><h2 className="text-base font-bold text-ink">Password & security</h2><p className="text-xs text-ink-muted">{hasPassword ? "Change your password regularly to keep your account secure." : "This account signs in with Google and does not use a CivicIssue password."}</p></div>
      </div>
      {hasPassword ? (
        <form onSubmit={save} className="space-y-4">
          <Field label="Current password" required>{(id) => <Input id={id} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />}</Field>
          <Field label="New password" required hint="At least 8 characters, including uppercase, lowercase and a number.">{(id) => <Input id={id} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />}</Field>
          <Field label="Confirm new password" required>{(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />}</Field>
          {error && <p className="rounded-lg bg-alert-soft px-3 py-2 text-xs font-medium text-alert" role="alert">{error}</p>}
          <div className="flex justify-end"><Button type="submit" loading={saving}>Update password</Button></div>
        </form>
      ) : (
        <p className="rounded-lg bg-info-soft px-3 py-3 text-xs leading-relaxed text-info">Your account is connected through Google sign-in. Password management is handled by your Google account.</p>
      )}
    </section>
  );
}
