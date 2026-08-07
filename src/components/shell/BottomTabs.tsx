"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/components/providers/SessionProvider";
import { isActive, MOBILE_TABS } from "./nav";
import { cn } from "@/lib/utils";

/**
 * Phone/tablet tab bar (brief §4.1, <1024px). Sits below the mini-player and
 * respects the iOS home-indicator inset.
 */
export function BottomTabs() {
  const pathname = usePathname();
  const user = useSession();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur safe-b lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab.href);
          // Guests still see the tab, but it routes them to sign-in with a
          // "next" hop so they land where they meant to go.
          const href =
            tab.authOnly && !user
              ? `/login?next=${encodeURIComponent(tab.href)}`
              : tab.href;

          return (
            <li key={tab.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium transition-colors",
                  active ? "text-accent-soft" : "text-muted",
                )}
              >
                <Icon
                  className={cn("size-5", active && "drop-shadow-[0_0_8px_currentColor]")}
                  aria-hidden="true"
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
