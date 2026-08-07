import Link from "next/link";
import type { ReactNode } from "react";
import { Music4, Shield, Users } from "lucide-react";

import { requirePageAdmin } from "@/lib/auth/page-guard";

const TABS = [
  { href: "/admin", label: "Overview", icon: Shield },
  { href: "/admin/songs", label: "Songs", icon: Music4 },
  { href: "/admin/users", label: "Users", icon: Users },
];

/**
 * Admin shell.
 *
 * The guard lives in the layout so every nested admin route is covered by
 * construction — a new page under /admin can't accidentally ship unprotected.
 * The API routes re-check independently; this is the UI half of §2.3.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageAdmin("/admin");

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Admin sections">
        <ul className="scrollbar-none flex gap-1.5 overflow-x-auto rounded-xl bg-surface-2 p-1">
          {TABS.map((tab) => (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                className="tap inline-flex items-center gap-2 rounded-lg px-4 text-fluid-sm font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text"
              >
                <tab.icon className="size-4" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {children}
    </div>
  );
}
