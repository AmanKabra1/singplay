"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Search, Settings, Shield, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/components/providers/SessionProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api/client";
import { initials } from "@/lib/utils";
import { toast } from "@/store/ui";

function AccountMenu() {
  const user = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <ButtonLink href="/login" variant="ghost" size="sm">
          Sign in
        </ButtonLink>
        <ButtonLink href="/signup" size="sm" className="hidden sm:inline-flex">
          Sign up free
        </ButtonLink>
      </div>
    );
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out", "Check your connection and try again.");
      setSigningOut(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="tap flex items-center gap-2 rounded-xl px-2 transition-colors hover:bg-surface-2"
      >
        <span className="grid size-8 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(user.displayName)
          )}
        </span>
        <span className="hidden max-w-28 truncate text-fluid-sm font-medium md:block">
          {user.displayName}
        </span>
        <ChevronDown className="size-4 text-muted" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-2xl animate-rise"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-fluid-sm font-semibold">{user.displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            {!user.verified && (
              <p className="mt-1.5 text-xs text-warning">Email not verified yet</p>
            )}
          </div>
          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-fluid-sm text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <Settings className="size-4" aria-hidden="true" />
            Profile &amp; settings
          </Link>
          {user.role === "admin" && (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-3 text-fluid-sm text-muted transition-colors hover:bg-surface-3 hover:text-text"
            >
              <Shield className="size-4" aria-hidden="true" />
              Admin dashboard
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-left text-fluid-sm text-muted transition-colors hover:bg-surface-3 hover:text-danger disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur-md lg:px-8">
      <Link href="/" className="flex items-center gap-2 font-bold lg:hidden">
        <span className="grid size-8 place-items-center rounded-lg bg-accent">
          <Sparkles className="size-4 text-white" aria-hidden="true" />
        </span>
        <span className="text-fluid-base">SingPlay</span>
      </Link>

      <form
        role="search"
        className="hidden min-w-0 flex-1 max-w-md sm:block"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = query.trim();
          if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
        }}
      >
        <label htmlFor="global-search" className="sr-only">
          Search songs, artists or lyrics
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            id="global-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Songs, artists, or a line of lyrics…"
            className="h-10 w-full rounded-full border border-border bg-surface-2 pl-9 pr-3 text-fluid-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="sm:hidden"
          onClick={() => router.push("/search")}
        >
          <Search className="size-5" aria-hidden="true" />
        </Button>
        <AccountMenu />
      </div>
    </header>
  );
}
