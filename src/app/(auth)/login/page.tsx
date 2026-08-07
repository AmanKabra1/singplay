import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { LoadingState } from "@/components/ui/States";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to SingPlay for full playback, karaoke mode and your DJ decks.",
};

export default async function LoginPage() {
  // Someone already signed in has no business on the sign-in page.
  if (await getSession()) redirect("/");

  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <LoginForm />
    </Suspense>
  );
}
