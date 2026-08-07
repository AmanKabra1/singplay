"use client";

import { Music2 } from "lucide-react";
import { useState } from "react";

import { cn, hueFromString } from "@/lib/utils";

/**
 * Cover art with a deterministic gradient fallback.
 *
 * Uses a plain `<img>` rather than `next/image` on purpose: cover art comes
 * from whatever R2 domain or catalog CDN the deployment happens to use, and a
 * host that isn't in `images.remotePatterns` makes `next/image` throw at
 * runtime. Native lazy loading + async decoding gives us the performance win
 * from brief §4.3 without that fragility.
 */
export function CoverArt({
  src,
  alt,
  seed,
  className,
  rounded = "rounded-lg",
  eager = false,
}: {
  src: string | null | undefined;
  alt: string;
  /** Usually the song title — keeps a given track's placeholder stable. */
  seed: string;
  className?: string;
  rounded?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const hue = hueFromString(seed);

  const showImage = src && !failed;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-surface-2",
        rounded,
        className,
      )}
      style={
        showImage
          ? undefined
          : {
              backgroundImage: `linear-gradient(135deg, hsl(${hue} 55% 28%), hsl(${(hue + 48) % 360} 62% 16%))`,
            }
      }
    >
      {showImage ? (
        /* Native <img> on purpose — see the note at the top of this file:
           `next/image` throws at runtime on a host that isn't listed in
           `images.remotePatterns`, and cover art comes from whatever CDN a
           given deployment happens to use. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center" aria-hidden="true">
          <Music2 className="size-1/3 max-h-10 min-h-4 text-white/35" />
        </div>
      )}
    </div>
  );
}
