"use client";

import { useEffect, useRef } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { formatDuration } from "@/lib/utils";

/**
 * Deck waveform (brief §3.5).
 *
 * Drawn on a canvas from real decoded peaks — when the peaks aren't available
 * (a CDN that blocks cross-origin reads) the caller renders a plain scrub bar
 * instead. Inventing a waveform would look better and mean nothing.
 */
export function Waveform({
  peaks,
  currentTime,
  duration,
  loop,
  cuePoint,
  accent,
  onSeek,
  loading,
}: {
  peaks: Float32Array | null;
  currentTime: number;
  duration: number;
  loop: { start: number; end: number } | null;
  cuePoint: number;
  accent: string;
  onSeek: (seconds: number) => void;
  loading: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !peaks) return;

    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const progress = duration > 0 ? currentTime / duration : 0;
      const middle = height / 2;
      const barWidth = 2;
      const gap = 1;
      const barCount = Math.floor(width / (barWidth + gap));

      if (loop && duration > 0) {
        ctx.fillStyle = "rgba(34, 211, 238, 0.14)";
        const start = (loop.start / duration) * width;
        ctx.fillRect(start, 0, ((loop.end - loop.start) / duration) * width, height);
      }

      for (let bar = 0; bar < barCount; bar++) {
        // Map each screen bar back into the peak array, so the waveform is the
        // same shape at any width rather than a stretched slice of it.
        const peak = peaks[Math.floor((bar / barCount) * peaks.length)] ?? 0;
        const barHeight = Math.max(2, peak * (height - 4));
        const x = bar * (barWidth + gap);
        ctx.fillStyle = x / width <= progress ? accent : "rgba(160, 158, 189, 0.32)";
        ctx.fillRect(x, middle - barHeight / 2, barWidth, barHeight);
      }

      if (duration > 0 && cuePoint > 0) {
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect((cuePoint / duration) * width, 0, 2, height);
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.min(progress * width, width - 2), 0, 2, height);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [peaks, currentTime, duration, loop, cuePoint, accent]);

  function seekFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (duration <= 0 || rect.width === 0) return;
    onSeek(((event.clientX - rect.left) / rect.width) * duration);
  }

  if (loading) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }

  if (!peaks) {
    // Honest fallback: a working scrub bar, not a decorative fake waveform.
    return (
      <div className="flex h-20 flex-col justify-center gap-2 rounded-xl border border-dashed border-border px-3">
        <input
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Deck position"
          aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
          style={{
            ["--track" as string]: `linear-gradient(to right, ${accent} ${
              duration > 0 ? (currentTime / duration) * 100 : 0
            }%, var(--color-surface-3) ${duration > 0 ? (currentTime / duration) * 100 : 0}%)`,
          }}
        />
        <p className="text-center text-[0.7rem] text-faint">
          Waveform unavailable for this source
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={seekFromPointer}
      role="slider"
      tabIndex={0}
      aria-label="Deck position"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onSeek(currentTime + 5);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          onSeek(currentTime - 5);
        }
      }}
      className="h-20 w-full cursor-pointer overflow-hidden rounded-xl bg-surface-2"
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
