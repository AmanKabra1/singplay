import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyEmailScreen } from "@/components/auth/VerifyEmailScreen";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false },
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingState label="Confirming your email" />}>
      <VerifyEmailScreen />
    </Suspense>
  );
}
