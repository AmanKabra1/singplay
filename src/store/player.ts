"use client";

import { create } from "zustand";

import { getEngine } from "@/lib/audio/engine";
import { GUEST_PREVIEW_SECONDS } from "@/lib/constants";
import type { PlayMode, SongDTO } from "@/lib/types";
import { clamp } from "@/lib/utils";
import { useUiStore } from "./ui";

export type RepeatMode = "off" | "all" | "one";

type PlayerState = {
  /** Playback order. Differs from `sourceQueue` when shuffle is on. */
  queue: SongDTO[];
  /** The queue as the user built it, so shuffle can be undone losslessly. */
  sourceQueue: SongDTO[];
  index: number;

  isPlaying: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  playbackRate: number;
  mode: PlayMode;

  /** Set from the server session; gates full playback vs 30-second previews. */
  isAuthenticated: boolean;
  /** Per-song playback failure, rendered inline next to the track. */
  errorSongId: string | null;
  errorMessage: string | null;

  current: () => SongDTO | null;
};

type PlayerActions = {
  setAuthenticated: (value: boolean) => void;
  playSong: (song: SongDTO, queue?: SongDTO[], mode?: PlayMode) => void;
  playQueue: (songs: SongDTO[], startIndex?: number, mode?: PlayMode) => void;
  playAt: (index: number) => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  next: (options?: { auto?: boolean }) => void;
  previous: () => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setPlaybackRate: (rate: number) => void;
  enqueue: (song: SongDTO, position?: "next" | "end") => void;
  removeAt: (index: number) => void;
  clearQueue: () => void;
  clearError: () => void;
  /** Wires engine events into the store. Call once, from a client provider. */
  attach: () => () => void;
};

/** Guests hear the preview clip when one exists, capped at 30 seconds either way. */
function sourceFor(song: SongDTO, isAuthenticated: boolean) {
  return isAuthenticated ? song.audioUrl : (song.previewUrl ?? song.audioUrl);
}

function shuffled<T>(items: T[], keepFirst: T | null) {
  const rest = items.filter((item) => item !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return keepFirst ? [keepFirst, ...rest] : rest;
}

/** Fire-and-forget analytics; a failure here must never disturb playback. */
function recordPlay(songId: string, mode: PlayMode, msPlayed: number) {
  void fetch("/api/history", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ songId, mode, msPlayed }),
    keepalive: true,
  }).catch(() => {});
}

export const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => {
  let playStartedAt: number | null = null;
  let recordedForSongId: string | null = null;
  let detach: (() => void) | null = null;

  function startEngine(index: number, startAt = 0) {
    const state = get();
    const song = state.queue[index];
    const engine = getEngine();
    if (!song || !engine) return;

    playStartedAt = Date.now();
    recordedForSongId = null;

    set({
      index,
      currentTime: startAt,
      duration: song.durationSec || 0,
      buffering: true,
      errorSongId: null,
      errorMessage: null,
    });

    engine.setVolume(state.volume, state.muted);
    engine.setPlaybackRate(state.playbackRate);
    void engine.load(sourceFor(song, state.isAuthenticated), {
      autoplay: true,
      startAt,
    });
    engine.preload(
      state.queue[index + 1]
        ? sourceFor(state.queue[index + 1]!, state.isAuthenticated)
        : null,
    );

    engine.syncMediaSession(song, {
      play: () => get().resume(),
      pause: () => get().pause(),
      next: () => get().next(),
      previous: () => get().previous(),
      seek: (time) => get().seek(time),
    });
  }

  function flushPlay() {
    const { queue, index, mode } = get();
    const song = queue[index];
    if (!song || playStartedAt == null) return;
    const elapsed = Date.now() - playStartedAt;
    // Only count a play once the listener has actually committed to the track.
    if (elapsed > 8000 && recordedForSongId !== song.id) {
      recordedForSongId = song.id;
      recordPlay(song.id, mode, elapsed);
    }
  }

  return {
    queue: [],
    sourceQueue: [],
    index: -1,
    isPlaying: false,
    buffering: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    shuffle: false,
    repeat: "off",
    playbackRate: 1,
    mode: "player",
    isAuthenticated: false,
    errorSongId: null,
    errorMessage: null,

    current: () => {
      const { queue, index } = get();
      return queue[index] ?? null;
    },

    setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

    playSong: (song, queue, mode = "player") => {
      const list = queue?.length ? queue : [song];
      const startIndex = Math.max(
        0,
        list.findIndex((s) => s.id === song.id),
      );
      get().playQueue(list, startIndex, mode);
    },

    playQueue: (songs, startIndex = 0, mode = "player") => {
      if (songs.length === 0) return;
      flushPlay();
      const anchor = songs[clamp(startIndex, 0, songs.length - 1)]!;
      const order = get().shuffle ? shuffled(songs, anchor) : songs;
      const index = order.findIndex((s) => s.id === anchor.id);
      set({ queue: order, sourceQueue: songs, mode });
      startEngine(index < 0 ? 0 : index);
    },

    playAt: (index) => {
      const { queue } = get();
      if (index < 0 || index >= queue.length) return;
      flushPlay();
      startEngine(index);
    },

    toggle: () => (get().isPlaying ? get().pause() : get().resume()),

    pause: () => {
      getEngine()?.pause();
      flushPlay();
    },

    resume: () => {
      const { index, queue } = get();
      const engine = getEngine();
      if (!engine) return;
      if (index < 0 && queue.length > 0) {
        startEngine(0);
        return;
      }
      playStartedAt ??= Date.now();
      void engine.play();
    },

    next: ({ auto = false } = {}) => {
      const { index, queue, repeat } = get();
      flushPlay();

      if (auto && repeat === "one") {
        getEngine()?.seek(0);
        void getEngine()?.play();
        return;
      }

      const nextIndex = index + 1;
      if (nextIndex < queue.length) {
        startEngine(nextIndex);
        return;
      }
      if (repeat === "all" && queue.length > 0) {
        startEngine(0);
        return;
      }
      // End of queue: stop cleanly rather than silently looping.
      getEngine()?.pause();
      getEngine()?.seek(0);
      set({ isPlaying: false, currentTime: 0 });
    },

    previous: () => {
      const { index, currentTime } = get();
      // Standard player behaviour: restart the track unless we're near its start.
      if (currentTime > 3) {
        get().seek(0);
        return;
      }
      if (index > 0) {
        flushPlay();
        startEngine(index - 1);
      } else {
        get().seek(0);
      }
    },

    seek: (seconds) => {
      const { isAuthenticated } = get();
      const capped =
        isAuthenticated || seconds < GUEST_PREVIEW_SECONDS
          ? seconds
          : GUEST_PREVIEW_SECONDS;
      getEngine()?.seek(Math.max(0, capped));
      set({ currentTime: Math.max(0, capped) });
    },

    seekBy: (delta) => get().seek(get().currentTime + delta),

    setVolume: (volume) => {
      const next = clamp(volume, 0, 1);
      set({ volume: next, muted: next === 0 ? get().muted : false });
      getEngine()?.setVolume(next, next === 0 ? get().muted : false);
    },

    toggleMute: () => {
      const muted = !get().muted;
      set({ muted });
      getEngine()?.setVolume(get().volume, muted);
    },

    toggleShuffle: () => {
      const { shuffle, sourceQueue, queue, index } = get();
      const currentSong = queue[index] ?? null;
      const nextShuffle = !shuffle;
      const base = sourceQueue.length ? sourceQueue : queue;
      const order = nextShuffle ? shuffled(base, currentSong) : base;
      const nextIndex = currentSong
        ? order.findIndex((s) => s.id === currentSong.id)
        : -1;
      set({
        shuffle: nextShuffle,
        queue: order,
        index: nextIndex < 0 ? get().index : nextIndex,
      });
    },

    cycleRepeat: () => {
      const order: RepeatMode[] = ["off", "all", "one"];
      set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length]! });
    },

    setPlaybackRate: (rate) => {
      set({ playbackRate: rate });
      getEngine()?.setPlaybackRate(rate);
    },

    enqueue: (song, position = "end") => {
      const { queue, index } = get();
      if (queue.length === 0) {
        get().playSong(song);
        return;
      }
      const next = [...queue];
      next.splice(position === "next" ? index + 1 : next.length, 0, song);
      set({ queue: next, sourceQueue: next });
    },

    removeAt: (removeIndex) => {
      const { queue, index } = get();
      if (removeIndex < 0 || removeIndex >= queue.length) return;
      const next = queue.filter((_, i) => i !== removeIndex);
      set({
        queue: next,
        sourceQueue: next,
        index: removeIndex < index ? index - 1 : index,
      });
      if (removeIndex === index) {
        if (next.length === 0) {
          getEngine()?.pause();
          set({ index: -1, isPlaying: false, currentTime: 0 });
        } else {
          startEngine(Math.min(index, next.length - 1));
        }
      }
    },

    clearQueue: () => {
      getEngine()?.pause();
      set({
        queue: [],
        sourceQueue: [],
        index: -1,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
      });
    },

    clearError: () => set({ errorSongId: null, errorMessage: null }),

    attach: () => {
      if (detach) return detach;
      const engine = getEngine();
      if (!engine) return () => {};

      const unsubscribe = engine.subscribe((event) => {
        switch (event.type) {
          case "time": {
            const { isAuthenticated, queue, index } = get();
            // Guest preview cut-off, enforced client-side as a courtesy; the
            // server also only hands guests a preview URL.
            if (!isAuthenticated && event.currentTime >= GUEST_PREVIEW_SECONDS) {
              engine.pause();
              engine.seek(0);
              set({ currentTime: 0, isPlaying: false });
              useUiStore.getState().promptSignup("playback");
              return;
            }
            set({
              currentTime: event.currentTime,
              duration: event.duration || queue[index]?.durationSec || 0,
              buffering: false,
            });
            break;
          }
          case "durationchange":
            if (event.duration > 0) set({ duration: event.duration });
            break;
          case "play":
            set({ isPlaying: true, buffering: false });
            break;
          case "pause":
            set({ isPlaying: false });
            break;
          case "waiting":
            set({ buffering: true });
            break;
          case "canplay":
            set({ buffering: false });
            break;
          case "ended":
            set({ isPlaying: false });
            get().next({ auto: true });
            break;
          case "error": {
            const { queue, index } = get();
            const song = queue[index];
            set({
              isPlaying: false,
              buffering: false,
              errorSongId: song?.id ?? null,
              errorMessage: event.message,
            });
            // Don't freeze on a dead track — surface the error and move on.
            if (index < queue.length - 1) {
              useUiStore.getState().toast({
                title: "Skipped a track",
                description: `${song?.title ?? "That track"} — ${event.message}`,
                variant: "error",
              });
              setTimeout(() => get().next(), 600);
            } else {
              useUiStore.getState().toast({
                title: "Playback failed",
                description: event.message,
                variant: "error",
              });
            }
            break;
          }
        }
      });

      const onOffline = () => useUiStore.getState().setOnline(false);
      const onOnline = () => useUiStore.getState().setOnline(true);
      window.addEventListener("offline", onOffline);
      window.addEventListener("online", onOnline);
      useUiStore.getState().setOnline(navigator.onLine);

      // Best-effort flush of the in-progress play when the tab goes away.
      const onHide = () => flushPlay();
      document.addEventListener("visibilitychange", onHide);

      detach = () => {
        unsubscribe();
        window.removeEventListener("offline", onOffline);
        window.removeEventListener("online", onOnline);
        document.removeEventListener("visibilitychange", onHide);
        detach = null;
      };
      return detach;
    },
  };
});
