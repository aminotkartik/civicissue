import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/forms/auth-shell";
import { LoginForm } from "@/components/forms/login-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

const DEMO_ACCOUNTS = [
  { label: "Citizen", email: "citizen@example.com" },
  { label: "Authority", email: "authority@example.com" },
  { label: "Field Worker", email: "worker@example.com" },
  { label: "Admin", email: "admin@example.com" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(
      user.role === "ADMIN" ? "/admin" : user.role === "AUTHORITY" ? "/authority" : user.role === "WORKER" ? "/worker" : "/dashboard"
    );
  }
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const showDemo = process.env.NODE_ENV !== "production";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to report issues, track your complaints and follow your neighbourhood."
      footer={
        <>
          New to CivicIssue?{" "}
          <Link href="/register" className="font-semibold text-terra-600 hover:text-terra-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm
          googleEnabled={googleEnabled}
          demoAccounts={showDemo ? DEMO_ACCOUNTS : undefined}
          demoPassword={showDemo ? process.env.DEMO_SEED_PASSWORD : undefined}
        />
      </Suspense>
    </AuthShell>
  );
}
