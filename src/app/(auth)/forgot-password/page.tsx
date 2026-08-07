import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a link to reset your SingPlay password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
