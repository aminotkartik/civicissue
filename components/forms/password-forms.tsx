"use client";

import { useState, type FormEvent, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ message: string; devLink?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string; devResetLink?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult({ message: data.message ?? "Check your email for a reset link.", devLink: data.devResetLink });
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-verdant/30 bg-verdant-soft px-4 py-3.5" role="status">
          <p className="text-sm font-medium text-ink">{result.message}</p>
        </div>
        {result.devLink && (
          <div className="rounded-xl border border-dashed border-amber-accent/40 bg-amber-soft px-4 py-3.5">
            <p className="text-xs font-semibold text-ink">Demo mode — email provider not configured.</p>
            <p className="mt-1 text-xs text-ink-soft">Your reset link (normally sent by email):</p>
            <Link href={result.devLink} className="mt-1.5 block break-all text-xs font-mono text-terra-700 underline">
              {result.devLink}
            </Link>
          </div>
        )}
        <Button variant="secondary" className="w-full" onClick={() => { setResult(null); setEmail(""); }}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && (
        <p className="rounded-lg bg-alert-soft px-3.5 py-2.5 text-xs font-medium text-alert" role="alert">{error}</p>
      )}
      <Field label="Email address" required hint="For your privacy, we never reveal whether an email is registered.">
        {(id) => (
          <Input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        )}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
        {!loading && <Mail className="h-4 w-4" aria-hidden />} Send reset link
      </Button>
    </form>
  );
}

function ResetFormInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string; message?: string; issues?: { path: string; message: string }[] };
      if (!res.ok) {
        setError(data.issues?.[0]?.message ?? data.error ?? "Reset failed.");
        return;
      }
      toast.success("Password reset. You can now log in with your new password.");
      router.push("/login");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-alert/30 bg-alert-soft px-4 py-3.5 text-sm text-alert" role="alert">
        This reset link is invalid. Please request a new one from the{" "}
        <Link href="/forgot-password" className="font-semibold underline">forgot password page</Link>.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && (
        <p className="rounded-lg bg-alert-soft px-3.5 py-2.5 text-xs font-medium text-alert" role="alert">{error}</p>
      )}
      <Field label="New password" required hint="At least 8 characters with an uppercase letter, a lowercase letter and a number.">
        {(id) => <Input id={id} type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field label="Confirm new password" required>
        {(id) => <Input id={id} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
        {!loading && <KeyRound className="h-4 w-4" aria-hidden />} Reset password
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<div className="skeleton h-40 w-full" />}>
      <ResetFormInner />
    </Suspense>
  );
}
