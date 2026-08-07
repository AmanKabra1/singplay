"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

import { usePlayerStore } from "@/store/player";
import type { SessionUser } from "@/lib/types";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: ReactNode;
}) {
  const setAuthenticated = usePlayerStore((s) => s.setAuthenticated);

  useEffect(() => {
    // The player needs to know whether to serve full tracks or 30s previews.
    setAuthenticated(Boolean(user));
  }, [user, setAuthenticated]);

  return <SessionContext value={user}>{children}</SessionContext>;
}

/** Current user, or null for guests. */
export function useSession() {
  return useContext(SessionContext);
}

/** True when a feature is available — i.e. signed in. */
export function useIsAuthenticated() {
  return useContext(SessionContext) !== null;
}
