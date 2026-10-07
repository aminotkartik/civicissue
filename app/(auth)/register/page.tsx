import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/forms/auth-shell";
import { RegisterForm } from "@/components/forms/register-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <AuthShell
      title="Create your CivicIssue account"
      subtitle="Free for every citizen. Report issues, track resolutions and support your neighbourhood."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-terra-600 hover:text-terra-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
