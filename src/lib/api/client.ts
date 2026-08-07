"use client";

import type { ApiErrorBody } from "./http";

/** Client-side mirror of the server's ApiError, carrying the same code. */
export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "RequestError";
  }

  /** Field-level messages from a 422, if the server sent any. */
  get fieldErrors(): Record<string, string> {
    return this.details && typeof this.details === "object"
      ? (this.details as Record<string, string>)
      : {};
  }

  get isOffline() {
    return this.code === "offline";
  }
}

export type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Retries on network failure / 5xx with a short backoff. Default 1. */
  retries?: number;
};

/**
 * The single fetch used by every client component.
 *
 * Guarantees: a thrown `RequestError` with a human-readable message in every
 * failure path, including "browser is offline" and "server returned HTML".
 */
export async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { body, retries = 1, headers, ...rest } = options;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new RequestError(0, "offline", "You're offline. Reconnect and try again.");
  }

  let lastError: RequestError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...rest,
        headers: {
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (response.status === 204) return undefined as T;

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        if (response.ok) return undefined as T;
        throw new RequestError(
          response.status,
          "unexpected_response",
          `The server returned an unexpected response (${response.status}).`,
        );
      }

      const payload = (await response.json()) as T | ApiErrorBody;

      if (!response.ok) {
        const err = (payload as ApiErrorBody).error;
        throw new RequestError(
          response.status,
          err?.code ?? "unknown",
          err?.message ?? "Something went wrong. Please try again.",
          err?.details,
        );
      }

      return payload as T;
    } catch (error) {
      const wrapped =
        error instanceof RequestError
          ? error
          : new RequestError(
              0,
              "network_error",
              "Couldn't reach the server. Check your connection.",
            );

      // 4xx are the caller's problem — never retry those.
      const retryable = wrapped.status === 0 || wrapped.status >= 500;
      if (!retryable || attempt === retries) throw wrapped;

      lastError = wrapped;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }

  throw lastError ?? new RequestError(0, "unknown", "Something went wrong.");
}

export function errorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof RequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
