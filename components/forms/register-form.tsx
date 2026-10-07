"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Eye, EyeOff, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { cn } from "@/lib/utils/format";

const REQUIREMENTS = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
];

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    city: "",
    locality: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.password !== form.confirmPassword) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    setGlobalError(null);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; issues?: { path: string; message: string }[] };
      if (!res.ok) {
        if (data.issues?.length) {
          const byField: Record<string, string> = {};
          for (const i of data.issues) byField[i.path] = i.message;
          setErrors(byField);
        }
        setGlobalError(data.error ?? "We couldn't create your account. Please check the form.");
        return;
      }
      toast.success("Welcome to CivicIssue! Your account is ready.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setGlobalError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {globalError && (
        <p className="rounded-lg bg-alert-soft px-3.5 py-2.5 text-xs font-medium text-alert" role="alert">
          {globalError}
        </p>
      )}
      <Field label="Full name" required error={errors.name}>
        {(id) => (
          <Input id={id} required autoComplete="name" value={form.name} onChange={set("name")} placeholder="e.g. Ananya Deshmukh" aria-invalid={!!errors.name || undefined} />
        )}
      </Field>
      <Field label="Email address" required error={errors.email}>
        {(id) => (
          <Input id={id} type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@example.com" aria-invalid={!!errors.email || undefined} />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" required error={errors.password} hint="We store passwords only as salted hashes.">
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={form.password}
                onChange={set("password")}
                className="pr-11"
                aria-invalid={!!errors.password || undefined}

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
        <Field label="Confirm password" required error={errors.confirmPassword}>
          {(id) => (
            <Input id={id} type={showPassword ? "text" : "password"} required autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} aria-invalid={!!errors.confirmPassword || undefined} />
          )}
        </Field>
      </div>
      <ul id="password-reqs" className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-surface-2/70 px-3.5 py-3 text-[11px]">
        {REQUIREMENTS.map((r) => {
          const met = r.test(form.password);
          return (
            <li key={r.label} className={cn("flex items-center gap-1.5", form.password ? (met ? "text-verdant" : "text-ink-muted") : "text-ink-muted")}>
              {met ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3 opacity-50" aria-hidden />}
              {r.label}
            </li>
          );
        })}
      </ul>
      <Field label="Phone number" optional error={errors.phone}>
        {(id) => <Input id={id} type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" aria-invalid={!!errors.phone || undefined} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" required error={errors.city}>
          {(id) => <Input id={id} required autoComplete="address-level2" value={form.city} onChange={set("city")} placeholder="Pune" aria-invalid={!!errors.city || undefined} />}
        </Field>
        <Field label="Locality / area" optional error={errors.locality} hint="Helps us show you nearby issues.">
          {(id) => <Input id={id} autoComplete="address-level3" value={form.locality} onChange={set("locality")} placeholder="Kothrud" />}
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
        {!loading && <UserPlus className="h-4 w-4" aria-hidden />} Create account
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-ink-muted">
        By registering you agree to our <a href="/terms" className="underline hover:text-terra-600">Terms</a> and{" "}
        <a href="/privacy" className="underline hover:text-terra-600">Privacy Policy</a>. Please don&apos;t include
        sensitive personal information in your reports.
      </p>
    </form>
  );
}
