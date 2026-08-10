"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthDivider, GoogleButton } from "@/components/auth/GoogleButton";
import { StrengthMeter } from "@/components/auth/StrengthMeter";
import { Button } from "@/components/ui/Button";
import { Field, FormError, PasswordInput, TextInput } from "@/components/ui/Field";
import { apiFetch, errorMessage, RequestError } from "@/lib/api/client";
import { clearFetchCache } from "@/lib/hooks/useFetch";
import { toast } from "@/store/ui";

/** Sign-up form (brief §3.1), with client-side validation before submit. */
export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();

  const rawNext = params.get("next");
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** Mirrors the server's rules so obvious mistakes never cost a round trip. */
  function validate() {
    const errors: Record<string, string> = {};
    if (displayName.trim().length < 2) {
      errors.displayName = "Use at least 2 characters.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "That doesn't look like a valid email address.";
    }
    if (password.length < 8) errors.password = "Use at least 8 characters.";
    else if (!/[a-z]/i.test(password)) errors.password = "Include at least one letter.";
    else if (!/\d/.test(password)) errors.password = "Include at least one number.";
    return errors;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      const result = await apiFetch<{ verificationEmailSent: boolean }>(
        "/api/auth/signup",
        {
          method: "POST",
          body: { displayName: displayName.trim(), email, password, remember: true },
        },
      );
      clearFetchCache();
      toast.success(
        "Welcome to SingPlay",
        result.verificationEmailSent
          ? "Check your inbox to confirm your email."
          : "Your account is ready.",
      );
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
        <h1 className="text-fluid-xl font-bold">Create your account</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          Free, and it takes about twenty seconds.
        </p>
      </header>

      <GoogleButton next={next} label="Sign up with Google" />
      <AuthDivider />

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />

        <Field label="Display name" required error={fieldErrors.displayName}>
          {(props) => (
            <TextInput
              {...props}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              autoFocus
              maxLength={80}
              placeholder="Alex Rivera"
            />
          )}
        </Field>

        <Field label="Email" required error={fieldErrors.email}>
          {(props) => (
            <TextInput
              {...props}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          )}
        </Field>

        <Field
          label="Password"
          required
          error={fieldErrors.password}
          hint="At least 8 characters, with a letter and a number."
        >
          {(props) => (
            <PasswordInput
              {...props}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>

        {password.length > 0 && <StrengthMeter value={password} />}

        <Button type="submit" size="lg" loading={busy} className="w-full">
          Create account
        </Button>
      </form>

      <p className="text-center text-fluid-sm text-muted">
        Already have an account?{" "}
        <Link
          href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-accent-soft hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
