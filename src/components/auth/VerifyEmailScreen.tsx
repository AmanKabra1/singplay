"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LoadingState } from "@/components/ui/States";
import { apiFetch, errorMessage } from "@/lib/api/client";

type Status = "working" | "done" | "failed";

/**
 * Consumes the confirmation token from the email link.
 *
 * The token is spent from a client effect rather than during a server render:
 * verification is a single-use mutation, and render passes are not guaranteed to
 * happen exactly once.
 */
export function VerifyEmailScreen() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [status, setStatus] = useState<Status>(token ? "working" : "failed");
  const [message, setMessage] = useState(
    token ? "" : "This confirmation link is missing its token.",
  );
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    apiFetch("/api/auth/verify-email", { method: "POST", body: { token } })
      .then(() => {
        setStatus("done");
        // The session cookie was re-minted with `verified: true` — refresh so
        // the "confirm your email" banner disappears.
        router.refresh();
      })
      .catch((error) => {
        setStatus("failed");
        setMessage(errorMessage(error));
      });
  }, [token, router]);

  if (status === "working") {
    return <LoadingState label="Confirming your email" />;
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-success/15 text-success">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-fluid-xl font-bold">Email confirmed</h1>
        <p className="text-fluid-sm leading-relaxed text-muted">
          Your account is fully set up. Time to find something to sing.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="tap inline-flex items-center rounded-xl bg-accent px-5 text-fluid-sm font-semibold text-white transition-colors hover:bg-accent-soft"
          >
            Start listening
          </Link>
          <Link
            href="/dashboard"
            className="tap inline-flex items-center rounded-xl border border-border-strong px-5 text-fluid-sm font-medium transition-colors hover:bg-surface-2"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-danger/15 text-danger">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <h1 className="text-fluid-xl font-bold">We couldn&apos;t confirm that</h1>
      <p className="text-fluid-sm leading-relaxed text-muted">{message}</p>
      <p className="text-xs text-faint">
        Confirmation links expire after 24 hours and can only be used once.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="tap inline-flex items-center rounded-xl bg-accent px-5 text-fluid-sm font-semibold text-white transition-colors hover:bg-accent-soft"
        >
          Continue to SingPlay
        </Link>
        <Link
          href="/profile"
          className="tap inline-flex items-center rounded-xl border border-border-strong px-5 text-fluid-sm font-medium transition-colors hover:bg-surface-2"
        >
          Account settings
        </Link>
      </div>
      <p className="text-xs text-faint">
        Signed in? Use the “Resend link” button in the banner at the top of the app.
      </p>
    </div>
  );
}
