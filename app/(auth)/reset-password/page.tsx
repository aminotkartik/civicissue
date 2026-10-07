import type { Metadata } from "next";
import { AuthShell } from "@/components/forms/auth-shell";
import { ResetPasswordForm } from "@/components/forms/password-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Your reset link is valid for 30 minutes.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
