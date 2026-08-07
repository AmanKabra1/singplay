"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { apiFetch, errorMessage, RequestError } from "@/lib/api/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setSent(true);
    } catch (error) {
      if (error instanceof RequestError) setFieldErrors(error.fieldErrors);
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  // The confirmation is deliberately the same whether or not the address has an
  // account — this form must not double as an account-existence check.
  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-success/15 text-success">
          <MailCheck className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-fluid-xl font-bold">Check your inbox</h1>
        <p className="text-fluid-sm leading-relaxed text-muted">
          If <span className="font-medium text-text">{email}</span> has a SingPlay
          account, a reset link is on its way. It expires in an hour.
        </p>
        <p className="text-xs text-faint">
          Nothing arrived? Check spam, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="underline hover:text-muted"
          >
            try a different address
          </button>
          .
        </p>
        <Link
          href="/login"
          className="mt-2 text-fluid-sm font-semibold text-accent-soft hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-fluid-xl font-bold">Reset your password</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          Enter the email you signed up with and we&apos;ll send a link to choose
          a new password.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />

        <Field label="Email" required error={fieldErrors.email}>
          {(props) => (
            <TextInput
              {...props}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
            />
          )}
        </Field>

        <Button type="submit" size="lg" loading={busy} className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-fluid-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-accent-soft hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
