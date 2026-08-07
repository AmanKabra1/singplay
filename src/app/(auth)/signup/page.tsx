import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignupForm } from "@/components/auth/SignupForm";
import { LoadingState } from "@/components/ui/States";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a free SingPlay account to unlock full tracks and karaoke practice.",
};

export default async function SignupPage() {
  if (await getSession()) redirect("/");

  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <SignupForm />
    </Suspense>
  );
}
