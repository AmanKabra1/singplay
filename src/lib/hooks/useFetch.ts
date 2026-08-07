"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch, errorMessage, RequestError } from "@/lib/api/client";

/**
 * Tiny data-fetching hook with the three states every screen in this app needs:
 * loading (so we can show a skeleton), error (so we can show Retry) and data.
 *
 * A module-level cache backs it so returning to a page you've already visited
 * paints instantly instead of flashing a skeleton (brief §4.3).
 *
 * Design note: `loading` is *derived*, not stored, and the cache is read during
 * render rather than copied into state by an effect. That keeps the whole hook
 * free of synchronous setState-in-effect — the only state write outside an event
 * handler happens when a request actually resolves.
 */
const cache = new Map<string, unknown>();

export function clearFetchCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export type FetchState<T> = {
  data: T | undefined;
  loading: boolean;
  error: RequestError | null;
  refetch: () => void;
  setData: (updater: T | ((previous: T | undefined) => T)) => void;
};

/** What a resolved request left behind, tagged with the request it belongs to. */
type Resolved<T> = {
  url: string;
  nonce: number;
  data?: T;
  error: RequestError | null;
};

export function useFetch<T>(
  url: string | null,
  { cached = true }: { cached?: boolean } = {},
): FetchState<T> {
  const [nonce, setNonce] = useState(0);
  const [resolved, setResolved] = useState<Resolved<T> | null>(null);

  // A resolved entry only counts for the request currently in flight; a changed
  // URL or a refetch invalidates it without any state juggling.
  const current =
    resolved && resolved.url === url && resolved.nonce === nonce ? resolved : null;

  // On the first attempt for a URL, a warm cache entry is the answer already.
  const seeded =
    !current && url && cached && nonce === 0
      ? (cache.get(url) as T | undefined)
      : undefined;

  const data = current ? current.data : seeded;
  const error = current?.error ?? null;
  const loading = Boolean(url) && !current && data === undefined;

  useEffect(() => {
    if (!url) return;
    // Already painted from cache — no request needed.
    if (nonce === 0 && cached && cache.has(url)) return;

    let cancelled = false;

    apiFetch<T>(url)
      .then((result) => {
        if (cancelled) return;
        if (cached) cache.set(url, result);
        setResolved({ url, nonce, data: result, error: null });
      })
      .catch((cause) => {
        if (cancelled) return;
        setResolved({
          url,
          nonce,
          error:
            cause instanceof RequestError
              ? cause
              : new RequestError(0, "unknown", errorMessage(cause)),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [url, nonce, cached]);

  const refetch = useCallback(() => {
    if (url) cache.delete(url);
    setNonce((n) => n + 1);
  }, [url]);

  const setData = useCallback(
    (updater: T | ((previous: T | undefined) => T)) => {
      if (!url) return;
      setResolved((previous) => {
        const base =
          previous && previous.url === url ? previous.data : (cache.get(url) as T | undefined);
        const next =
          typeof updater === "function"
            ? (updater as (p: T | undefined) => T)(base)
            : updater;
        if (cached) cache.set(url, next);
        return { url, nonce, data: next, error: null };
      });
    },
    [url, nonce, cached],
  );

  return { data, loading, error, refetch, setData };
}
