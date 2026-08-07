"use client";

/**
 * Google sign-in entry point.
 *
 * A plain link, not a fetch: the OAuth flow is a full-page redirect that has to
 * set the state cookie server-side before leaving for Google.
 */
export function GoogleButton({ next, label }: { next: string; label: string }) {
  return (
    <a
      href={`/api/auth/google?next=${encodeURIComponent(next)}`}
      className="tap flex items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-surface-2 px-4 text-fluid-sm font-medium text-text transition-colors hover:bg-surface-3"
    >
      <svg viewBox="0 0 18 18" className="size-[1.15rem]" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A8.99 8.99 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.11-1.18.29-1.72V4.94H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.34Z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
        />
      </svg>
      {label}
    </a>
  );
}

/** Separates the OAuth button from the email form. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-widest text-faint">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
