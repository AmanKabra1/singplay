import { Disc3 } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-surface-2 text-accent-soft">
        <Disc3 className="size-8 animate-spin-slow" aria-hidden="true" />
      </div>
      <p className="font-mono text-fluid-sm text-faint">404</p>
      <h1 className="text-fluid-2xl font-bold">This track skipped</h1>
      <p className="max-w-sm text-fluid-sm leading-relaxed text-muted">
        The page you were looking for isn&apos;t here. It may have been removed,
        or the link might be wrong.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="tap inline-flex items-center rounded-xl bg-accent px-5 text-fluid-sm font-semibold text-white transition-colors hover:bg-accent-soft"
        >
          Back to browsing
        </Link>
        <Link
          href="/search"
          className="tap inline-flex items-center rounded-xl border border-border-strong px-5 text-fluid-sm font-medium transition-colors hover:bg-surface-2"
        >
          Search the catalog
        </Link>
      </div>
    </div>
  );
}
