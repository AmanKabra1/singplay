"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Music2 } from "lucide-react";

import { useSession } from "@/components/providers/SessionProvider";
import { ADMIN_NAV, isActive, PRIMARY_NAV, type NavItem } from "./nav";
import { cn } from "@/lib/utils";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-fluid-sm font-medium transition-all duration-150",
        active
          ? "bg-linear-to-r from-accent/20 to-accent/5 text-accent-soft"
          : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon
        className={cn(
          "size-[1.15rem] shrink-0 transition-colors",
          active ? "text-accent-soft" : "text-faint group-hover:text-muted",
        )}
        aria-hidden="true"
      />
      <span className="truncate">{item.label}</span>
      {active && (
        <span
          className="ml-auto size-1.5 rounded-full bg-accent-soft"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useSession();

  const sections = user?.role === "admin" ? [...PRIMARY_NAV, ADMIN_NAV] : PRIMARY_NAV;

  return (
    <aside
      aria-label="Main navigation"
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex"
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-3 px-5 py-5"
      >
        {/* Gradient icon mark */}
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl shadow-lg"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #a855f7, #22d3ee)",
            boxShadow: "0 4px 14px -2px rgb(139 92 246 / 0.45)",
          }}
        >
          <Music2 className="size-[1.1rem] text-white" aria-hidden="true" />
        </span>
        <span className="text-lg font-extrabold tracking-tight text-text">
          Sing
          <span
            style={{
              background: "linear-gradient(90deg, var(--color-accent-soft), var(--color-cyan))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Play
          </span>
        </span>
      </Link>

      {/* Nav sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {sections.map((section) => {
          const items = section.items.filter((item) => !item.authOnly || user);
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <h2 className="mb-1 px-3 text-[0.67rem] font-semibold uppercase tracking-[0.16em] text-faint">
                {section.title}
              </h2>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item.href)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Guest CTA / signed-in user summary */}
      {user ? (
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${hashHue(user.displayName)} 65% 40%), hsl(${hashHue(user.displayName) + 40} 55% 30%))`,
              }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text">{user.displayName}</p>
              <p className="truncate text-[0.65rem] text-faint capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-border p-4">
          <p className="mb-3 text-fluid-sm text-muted">
            Sign in for full tracks, karaoke mode and your own DJ decks.
          </p>
          <Link
            href="/login"
            className="tap flex items-center justify-center gap-2 rounded-xl bg-accent px-4 text-fluid-sm font-semibold text-white shadow-md shadow-accent/20 transition-colors hover:bg-accent-soft"
          >
            <LogIn className="size-4" aria-hidden="true" />
            Sign in
          </Link>
        </div>
      )}
    </aside>
  );
}

/** Deterministic hue from a string so each user's avatar has a consistent color. */
function hashHue(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) & 0xffff;
  }
  return h % 360;
}
