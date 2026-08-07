"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const BAR_COUNT = 14;

/**
 * Live input-level meter for the user's own voice (brief §3.4, optional).
 *
 * Deliberately *not* pitch detection: this is a "your mic is working and you're
 * loud enough" indicator, which is genuinely useful, honest about what it
 * measures, and cheap. Nothing is recorded, uploaded, or mixed into playback —
 * the stream is analysed in the browser and released the moment it's turned off.
 */
export function MicMeter() {
  const [enabled, setEnabled] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  function stop() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setLevel(0);
  }

  // Releasing the microphone on unmount matters: otherwise the browser's
  // recording indicator stays lit after the user has navigated away.
  useEffect(() => stop, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const context = new AudioContext();
      contextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      // Intentionally not connected to `context.destination` — routing the mic
      // to the speakers during karaoke would cause immediate feedback howl.

      const buffer = new Float32Array(analyser.fftSize);

      const tick = () => {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += sample * sample;
        const rms = Math.sqrt(sum / buffer.length);
        // RMS is tiny for speech; scale into something a bar meter can show.
        setLevel(Math.min(1, rms * 6));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      setEnabled(true);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser's site settings to see your level."
          : name === "NotFoundError"
            ? "No microphone was found on this device."
            : "Couldn't start the microphone.",
      );
      stop();
    }
  }

  function toggle() {
    if (enabled) {
      stop();
      setEnabled(false);
    } else {
      void start();
    }
  }

  const activeBars = Math.round(level * BAR_COUNT);

  return (
    <div className="flex min-w-0 items-center gap-3">
      {enabled && (
        <div
          className="flex items-end gap-0.5"
          role="meter"
          aria-label="Microphone level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
        >
          {Array.from({ length: BAR_COUNT }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={cn(
                "w-1 rounded-full transition-[height,background-color] duration-75",
                index < activeBars
                  ? index > BAR_COUNT - 3
                    ? "bg-danger"
                    : index > BAR_COUNT - 6
                      ? "bg-warning"
                      : "bg-success"
                  : "bg-surface-3",
              )}
              style={{ height: `${6 + index * 1.1}px` }}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        className={cn(
          "tap inline-flex items-center gap-2 rounded-xl border px-3 text-fluid-sm font-medium transition-colors",
          enabled
            ? "border-accent/40 bg-accent/10 text-accent-soft"
            : "border-border text-muted hover:bg-surface-2 hover:text-text",
        )}
      >
        {enabled ? (
          <Mic className="size-4" aria-hidden="true" />
        ) : (
          <MicOff className="size-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{enabled ? "Mic on" : "Show my mic level"}</span>
      </button>

      {error && (
        <p role="alert" className="max-w-56 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
