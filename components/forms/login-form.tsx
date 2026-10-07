"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

interface DemoAccount {
  label: string;
  email: string;
}

export function LoginForm({
  googleEnabled,
  demoAccounts,
  demoPassword,
}: {
  googleEnabled: boolean;
  demoAccounts?: DemoAccount[];
  demoPassword?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent, overrideEmail?: string, overridePassword?: string) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: overrideEmail ?? email,
          password: overridePassword ?? password,
        }),
      });
      const data = (await res.json()) as { error?: string; redirect?: string; role?: string };
      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }
      toast.success(`Welcome back! Signing you in…`);
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : data.redirect ?? "/dashboard");
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const oauthError = searchParams.get("error");

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {oauthError === "oauth_not_configured" && (
        <p className="rounded-lg bg-amber-soft px-3.5 py-2.5 text-xs font-medium text-ink-soft" role="status">
          Google sign-in isn&apos;t configured on this instance. Use email and password instead.
        </p>
      )}
      {(oauthError === "oauth_failed" || oauthError === "account_suspended") && (
        <p className="rounded-lg bg-alert-soft px-3.5 py-2.5 text-xs font-medium text-alert" role="alert">
          {oauthError === "account_suspended"
            ? "This account is suspended. Contact the administrator."
            : "Google sign-in failed. Please try again or use email and password."}
        </p>
      )}

      <Field label="Email address" required error={error && !error.includes("password") ? error : null}>
        {(id) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={!!error || undefined}
          />
        )}
      </Field>

      <Field label="Password" required error={error && error.toLowerCase().includes("password") ? error : null}>
        {(id) => (
          <div className="relative">
            <Input
              id={id}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="pr-11"
              aria-invalid={!!error || undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}
      </Field>

      {error && error.toLowerCase().includes("incorrect") && (
        <p className="text-xs font-medium text-alert" role="alert">{error}</p>
      )}
      {error && (error.toLowerCase().includes("suspended") || error.toLowerCase().includes("deactivated")) && (
        <p className="rounded-lg bg-alert-soft px-3.5 py-2.5 text-xs font-medium text-alert" role="alert">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <Link href="/forgot-password" className="text-[13px] font-medium text-terra-600 hover:text-terra-700 hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
        {!loading && <LogIn className="h-4 w-4" aria-hidden />} Log in
      </Button>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <a
            href="/api/auth/google"
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-surface text-sm font-semibold text-ink hover:bg-surface-2"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Continue with Google
          </a>
        </>
      )}

      {!!demoAccounts?.length && !!demoPassword && (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-2/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Demo accounts — one click to explore</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={(e) => onSubmit(e as unknown as FormEvent, acc.email, demoPassword)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-semibold text-ink-soft transition-colors hover:border-terra-300 hover:bg-terra-50 hover:text-terra-700 disabled:opacity-50"
              >
                {acc.label}
                <span className="mt-0.5 block truncate font-mono text-[10px] font-normal text-ink-muted">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
