"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthDivider, GoogleButton } from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/Button";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { apiFetch, errorMessage, RequestError } from "@/lib/api/client";
import { clearFetchCache } from "@/lib/hooks/useFetch";

/** Sign-in form (brief §3.1). Errors are inline and specific, never silent. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const rawNext = params.get("next");
  // Only same-origin relative paths — a `?next=` pointing off-site would be an
  // open redirect.
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // The OAuth callback redirects here with `?error=` when Google sign-in fails.
  // Read straight from the URL — copying it into state would just be a second
  // source of truth for the same message.
  const shownError = formError ?? params.get("error");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password, remember },
      });
      // Anything cached for the previous (or absent) session is now wrong.
      clearFetchCache();
      router.push(next);
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
        <h1 className="text-fluid-xl font-bold">Welcome back</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          Sign in for full tracks, karaoke mode and your own DJ decks.
        </p>
      </header>

      <GoogleButton next={next} label="Continue with Google" />
      <AuthDivider />

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={shownError} />

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

        <Field label="Password" required error={fieldErrors.password}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-fluid-sm text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 accent-accent"
            />
            Keep me signed in
          </label>
          <Link
            href="/forgot-password"
            className="text-fluid-sm font-medium text-accent-soft hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="text-center text-fluid-sm text-muted">
        New here?{" "}
        <Link
          href={next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-accent-soft hover:underline"
        >
          Create a free account
        </Link>
      </p>
    </div>
  );
}
