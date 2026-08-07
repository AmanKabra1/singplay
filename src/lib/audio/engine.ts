"use client";

import type { SongDTO } from "@/lib/types";

/**
 * The single `<audio>` element behind the whole app.
 *
 * Deliberately *not* routed through the Web Audio API: `MediaElementSource`
 * requires the audio host to send CORS headers, and third-party catalog CDNs
 * often don't. Plain element playback always works, which is the right
 * trade-off for the main player. The DJ panel — which genuinely needs a Web
 * Audio graph for filters and crossfading — opts into CORS separately and
 * degrades with an explicit message when a track can't be processed.
 *
 * A second, hidden element preloads the next track in the queue so skipping
 * forward starts near-instantly.
 */

export type EngineEvent =
  | { type: "time"; currentTime: number; duration: number }
  | { type: "durationchange"; duration: number }
  | { type: "play" }
  | { type: "pause" }
  | { type: "ended" }
  | { type: "waiting" }
  | { type: "canplay" }
  | { type: "error"; message: string };

type Listener = (event: EngineEvent) => void;

/** Chrome/Safari/Firefox all support `preservesPitch`; older builds used prefixes. */
type PitchPreservingAudio = HTMLAudioElement & {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

function describeMediaError(element: HTMLAudioElement): string {
  const code = element.error?.code;
  switch (code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Playback was cancelled.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "Lost connection while loading this track.";
    case MediaError.MEDIA_ERR_DECODE:
      return "This audio file appears to be corrupted.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "This track can't be played in your browser.";
    default:
      return "This track couldn't be played.";
  }
}

class AudioEngine {
  private element: HTMLAudioElement | null = null;
  private preloader: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private rafId: number | null = null;
  private currentSrc: string | null = null;
  private preloadedSrc: string | null = null;

  private ensure(): HTMLAudioElement {
    if (this.element) return this.element;

    const audio = new Audio();
    audio.preload = "metadata";
    audio.setAttribute("aria-hidden", "true");

    audio.addEventListener("play", () => {
      this.emit({ type: "play" });
      this.startTicking();
    });
    audio.addEventListener("pause", () => {
      this.emit({ type: "pause" });
      this.stopTicking();
    });
    audio.addEventListener("ended", () => {
      this.stopTicking();
      this.emit({ type: "ended" });
    });
    audio.addEventListener("waiting", () => this.emit({ type: "waiting" }));
    audio.addEventListener("canplay", () => this.emit({ type: "canplay" }));
    audio.addEventListener("durationchange", () =>
      this.emit({
        type: "durationchange",
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }),
    );
    audio.addEventListener("error", () => {
      this.stopTicking();
      this.emit({ type: "error", message: describeMediaError(audio) });
    });
    // `timeupdate` fires only ~4x/second, which is too coarse for karaoke
    // highlighting, so a rAF loop drives time while playing. This listener
    // keeps things accurate while paused or seeking.
    audio.addEventListener("timeupdate", () => this.tick());

    this.element = audio;
    return audio;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: EngineEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private tick = () => {
    const audio = this.element;
    if (!audio) return;
    this.emit({
      type: "time",
      currentTime: audio.currentTime,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
  };

  private startTicking() {
    if (this.rafId != null) return;
    const loop = () => {
      this.tick();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopTicking() {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Loads a source. Returns false if the browser blocked autoplay. */
  async load(src: string, { autoplay = true, startAt = 0 } = {}) {
    const audio = this.ensure();

    if (this.currentSrc !== src) {
      audio.src = src;
      audio.load();
      this.currentSrc = src;
    }
    if (startAt > 0) {
      audio.currentTime = startAt;
    }
    if (!autoplay) return true;
    return this.play();
  }

  async play() {
    const audio = this.ensure();
    try {
      await audio.play();
      return true;
    } catch (error) {
      // NotAllowedError = autoplay policy; the user simply needs to click.
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        this.emit({ type: "pause" });
        return false;
      }
      this.emit({ type: "error", message: describeMediaError(audio) });
      return false;
    }
  }

  pause() {
    this.element?.pause();
  }

  seek(seconds: number) {
    const audio = this.element;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
    this.tick();
  }

  setVolume(volume: number, muted: boolean) {
    const audio = this.ensure();
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.muted = muted;
  }

  /** Tempo change with pitch preserved — required for karaoke practice speeds. */
  setPlaybackRate(rate: number, preservePitch = true) {
    const audio = this.ensure() as PitchPreservingAudio;
    audio.preservesPitch = preservePitch;
    audio.mozPreservesPitch = preservePitch;
    audio.webkitPreservesPitch = preservePitch;
    audio.playbackRate = rate;
  }

  get currentTime() {
    return this.element?.currentTime ?? 0;
  }

  get duration() {
    const d = this.element?.duration;
    return Number.isFinite(d) ? (d as number) : 0;
  }

  get paused() {
    return this.element?.paused ?? true;
  }

  /** Warms the browser cache for the next track so skip-forward feels instant. */
  preload(src: string | null) {
    if (!src || src === this.preloadedSrc) return;
    this.preloader ??= new Audio();
    this.preloader.preload = "auto";
    this.preloader.src = src;
    this.preloadedSrc = src;
  }

  /** Media Session so lock-screen / headset controls work on phones. */
  syncMediaSession(
    song: SongDTO | null,
    handlers: {
      play: () => void;
      pause: () => void;
      next: () => void;
      previous: () => void;
      seek: (time: number) => void;
    },
  ) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    if (!song) {
      session.metadata = null;
      return;
    }

    session.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album ?? undefined,
      artwork: song.coverUrl ? [{ src: song.coverUrl, sizes: "512x512" }] : undefined,
    });

    try {
      session.setActionHandler("play", handlers.play);
      session.setActionHandler("pause", handlers.pause);
      session.setActionHandler("nexttrack", handlers.next);
      session.setActionHandler("previoustrack", handlers.previous);
      session.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) handlers.seek(details.seekTime);
      });
    } catch {
      // Some browsers only implement a subset of the action handlers.
    }
  }

  destroy() {
    this.stopTicking();
    this.element?.pause();
    this.element = null;
    this.preloader = null;
    this.listeners.clear();
    this.currentSrc = null;
    this.preloadedSrc = null;
  }
}

let engine: AudioEngine | null = null;

/** Browser-only singleton. Returns null during SSR. */
export function getEngine(): AudioEngine | null {
  if (typeof window === "undefined") return null;
  engine ??= new AudioEngine();
  return engine;
}

export type { AudioEngine };
