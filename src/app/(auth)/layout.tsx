import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/** Focused, single-column layout for sign-in, sign-up and recovery flows. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      {/* Purely decorative wash so the auth pages don't read as a blank slab. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 size-[28rem] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-52 -right-32 size-[30rem] rounded-full bg-cyan/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-7 flex items-center justify-center gap-2.5 text-xl font-bold tracking-tight"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-accent">
            <Sparkles className="size-5 text-white" aria-hidden="true" />
          </span>
          SingPlay
        </Link>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-2xl backdrop-blur sm:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-faint">
          SingPlay streams Creative Commons and admin-uploaded music only.{" "}
          <Link href="/" className="underline hover:text-muted">
            Back to browsing
          </Link>
        </p>
      </div>
    </div>
  );
}
