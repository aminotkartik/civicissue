import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/forms/auth-shell";
import { ForgotPasswordForm } from "@/components/forms/password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you registered with and we'll send you a secure reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-terra-600 hover:text-terra-700 hover:underline">
            Back to login
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
