"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { StrengthMeter } from "@/components/auth/StrengthMeter";
import { Button } from "@/components/ui/Button";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { apiFetch, errorMessage, RequestError } from "@/lib/api/client";
import { clearFetchCache } from "@/lib/hooks/useFetch";
import { toast } from "@/store/ui";

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // A link that arrived without its token can't be repaired here — say so and
  // point at the one thing that will work.
  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-danger/15 text-danger">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-fluid-xl font-bold">This link is incomplete</h1>
        <p className="text-fluid-sm leading-relaxed text-muted">
          The reset link is missing its token. Email clients sometimes break long
          links across lines — request a fresh one and open it in a single click.
        </p>
        <Link
          href="/forgot-password"
          className="tap mt-2 inline-flex items-center rounded-xl bg-accent px-5 text-fluid-sm font-semibold text-white"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (password !== confirm) {
      setFieldErrors({ confirm: "Those two passwords don't match." });
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      clearFetchCache();
      toast.success("Password updated", "You're signed in with your new password.");
      router.push("/");
      router.refresh();
    } catch (error) {
      if (error instanceof RequestError) setFieldErrors(error.fieldErrors);
      setFormError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-fluid-xl font-bold">Choose a new password</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          Pick something you don&apos;t use anywhere else. We&apos;ll sign you in
          straight away.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />

        <Field
          label="New password"
          required
          error={fieldErrors.password}
          hint="At least 8 characters, with a letter and a number."
        >
          {(props) => (
            <TextInput
              {...props}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              autoFocus
            />
          )}
        </Field>

        {password.length > 0 && <StrengthMeter value={password} />}

        <Field label="Confirm new password" required error={fieldErrors.confirm}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>

        <Button type="submit" size="lg" loading={busy} className="w-full">
          Set new password
        </Button>
      </form>

      <p className="text-center text-fluid-sm text-muted">
        Link expired?{" "}
        <Link
          href="/forgot-password"
          className="font-semibold text-accent-soft hover:underline"
        >
          Request another
        </Link>
      </p>
    </div>
  );
}
