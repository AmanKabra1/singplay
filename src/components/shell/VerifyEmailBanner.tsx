"use client";

import { MailWarning, X } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/components/providers/SessionProvider";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { toast } from "@/store/ui";

/**
 * Nudge for unverified accounts. Deliberately a dismissible banner rather than a
 * hard block: the brief gates features on *being signed in*, not on having
 * clicked the confirmation link, and locking people out of a working account
 * because an email is stuck in a queue is worse than a reminder.
 */
export function VerifyEmailBanner() {
  const user = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.verified || dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      const result = await apiFetch<{ message: string }>(
        "/api/auth/resend-verification",
        { method: "POST" },
      );
      toast.success("Check your inbox", result.message);
    } catch (error) {
      toast.error("Couldn't send that", errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-warning/25 bg-warning/10 px-4 py-2.5 text-fluid-sm lg:px-8"
    >
      <MailWarning className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-muted">
        Confirm your email to secure your account.{" "}
        <span className="text-faint">We sent a link to {user.email}.</span>
      </p>
      <button
        type="button"
        onClick={resend}
        disabled={sending}
        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-warning underline-offset-2 transition-colors hover:underline disabled:opacity-50"
      >
        {sending ? "Sending…" : "Resend link"}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="rounded-md p-1 text-faint transition-colors hover:text-text"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
