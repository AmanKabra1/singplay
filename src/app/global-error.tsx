"use client";

import { useEffect } from "react";

/**
 * Last line of defence: a crash in the root layout itself, where the app shell
 * and its stylesheet are not available. Everything here is inline on purpose.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[singplay] fatal error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#09090f",
          color: "#eceaf6",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.375rem", margin: "0 0 0.75rem" }}>
            SingPlay hit an unexpected error
          </h1>
          <p style={{ color: "#a2a0bd", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            The app couldn&apos;t recover on its own. Reloading almost always
            fixes it.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#8b5cf6",
              color: "#fff",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload SingPlay
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.25rem", fontSize: "0.75rem", color: "#6e6c8c" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
