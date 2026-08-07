"use client";

import { create } from "zustand";

import { AnalysisUnavailableError, analyseTrack } from "@/lib/audio/analysis";
import { DJ_PITCH_RANGE } from "@/lib/constants";
import type { SongDTO } from "@/lib/types";
import { clamp } from "@/lib/utils";

/**
 * The DJ booth's audio engine and its state (brief §3.5).
 *
 * Each deck is an `<audio>` element routed through a small Web Audio graph:
 *
 *     element ─▶ eqLow ─▶ eqMid ─▶ eqHigh ─▶ filter ─┬─▶ deck gain ─▶ crossfade gain ─▶ master ─▶ out
 *                                                       └─▶ delay ⇄ feedback ─▶ (wet) ┘
 *
 * The graph needs a cross-origin-readable source. Catalog CDNs don't always
 * send the headers for that, so a deck that fails to load with `crossOrigin`
 * retries without it and runs in *basic mode*: transport, tempo, volume and
 * crossfading all still work through the element itself, while the filter, echo
 * and mix recording are disabled and say so. That's the difference between a
 * degraded booth and a silent one.
 */

export type DeckId = "a" | "b";

export type DeckState = {
  song: SongDTO | null;
  loading: boolean;
  ready: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  /** Tempo offset as a fraction, −0.16..0.16 (±16%, classic CDJ range). */
  tempo: number;
  /** Master tempo: hold the pitch while the tempo moves. */
  keylock: boolean;
  volume: number;
  /** −1 = full low-pass sweep, 0 = off, +1 = full high-pass sweep. */
  filter: number;
  echo: number;
  cuePoint: number;
  loop: { start: number; end: number } | null;
  peaks: Float32Array | null;
  analysing: boolean;
  analysisNote: string | null;
  bpm: number | null;
  bpmSource: "metadata" | "detected" | null;
  /** False when the deck had to fall back to basic (non-Web-Audio) playback. */
  effectsAvailable: boolean;
  error: string | null;
  /** −1 = kill (−60 dB), 0 = flat, +1 = +12 dB */
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  hotCues: (number | null)[]; // 8 slots
};

export type RecordingState = {
  active: boolean;
  startedAt: number | null;
  url: string | null;
  mimeType: string | null;
  error: string | null;
};

type DjState = {
  decks: Record<DeckId, DeckState>;
  /** 0 = fully deck A, 1 = fully deck B. */
  crossfade: number;
  masterVolume: number;
  recording: RecordingState;
  /** True once at least one deck has been routed through the Web Audio graph. */
  audioGraphReady: boolean;
  sessionStartedAt: number | null;
};

type DjActions = {
  loadDeck: (deck: DeckId, song: SongDTO) => Promise<void>;
  ejectDeck: (deck: DeckId) => void;
  togglePlay: (deck: DeckId) => void;
  cue: (deck: DeckId) => void;
  setCuePoint: (deck: DeckId) => void;
  seek: (deck: DeckId, seconds: number) => void;
  nudge: (deck: DeckId, seconds: number) => void;
  setTempo: (deck: DeckId, tempo: number) => void;
  resetTempo: (deck: DeckId) => void;
  setKeylock: (deck: DeckId, keylock: boolean) => void;
  setVolume: (deck: DeckId, volume: number) => void;
  setFilter: (deck: DeckId, value: number) => void;
  setEcho: (deck: DeckId, value: number) => void;
  setLoopIn: (deck: DeckId) => void;
  setLoopOut: (deck: DeckId) => void;
  clearLoop: (deck: DeckId) => void;
  setCrossfade: (value: number) => void;
  setMasterVolume: (value: number) => void;
  startRecording: () => void;
  stopRecording: () => void;
  discardRecording: () => void;
  teardown: () => void;
  setEqLow: (deck: DeckId, value: number) => void;
  setEqMid: (deck: DeckId, value: number) => void;
  setEqHigh: (deck: DeckId, value: number) => void;
  setHotCue: (deck: DeckId, index: number) => void;
  jumpToHotCue: (deck: DeckId, index: number) => void;
  clearHotCue: (deck: DeckId, index: number) => void;
  sync: (deck: DeckId) => void;
};

const emptyDeck = (): DeckState => ({
  song: null,
  loading: false,
  ready: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  tempo: 0,
  keylock: true,
  volume: 0.85,
  filter: 0,
  echo: 0,
  cuePoint: 0,
  loop: null,
  peaks: null,
  analysing: false,
  analysisNote: null,
  bpm: null,
  bpmSource: null,
  effectsAvailable: true,
  error: null,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  hotCues: [null, null, null, null, null, null, null, null],
});

/** Equal-power crossfade: constant perceived loudness through the sweep. */
function crossfadeGains(position: number) {
  const angle = (clamp(position, 0, 1) * Math.PI) / 2;
  return { a: Math.cos(angle), b: Math.sin(angle) };
}

type Chain = {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  eqLow: BiquadFilterNode | null;
  eqMid: BiquadFilterNode | null;
  eqHigh: BiquadFilterNode | null;
  filter: BiquadFilterNode | null;
  delay: DelayNode | null;
  feedback: GainNode | null;
  wet: GainNode | null;
  gain: GainNode | null;
  fade: GainNode | null;
  raf: number | null;
  analysisAbort: AbortController | null;
};

export const useDjStore = create<DjState & DjActions>((set, get) => {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let recorderDestination: MediaStreamAudioDestinationNode | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  const chains: Record<DeckId, Chain | null> = { a: null, b: null };

  function patch(deck: DeckId, changes: Partial<DeckState>) {
    set((state) => ({
      decks: { ...state.decks, [deck]: { ...state.decks[deck], ...changes } },
    }));
  }

  function ensureContext() {
    context ??= new AudioContext();
    if (!master) {
      master = context.createGain();
      master.gain.value = get().masterVolume;
      master.connect(context.destination);
    }
    // Browsers start the context suspended until a user gesture; every entry
    // point into this store is one, so resuming here is always safe.
    if (context.state === "suspended") void context.resume();
    return { context, master };
  }

  /** Builds the Web Audio chain for a deck. Returns false if routing failed. */
  function connectGraph(deck: DeckId, chain: Chain) {
    try {
      const { context: ctx, master: out } = ensureContext();

      const source = ctx.createMediaElementSource(chain.element);

      // Build in this order: source → eqLow → eqMid → eqHigh → filter(sweep) → [echo] → gain → fade → master
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = "lowshelf";
      eqLow.frequency.value = 80;
      eqLow.gain.value = 0;

      const eqMid = ctx.createBiquadFilter();
      eqMid.type = "peaking";
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 0.8;
      eqMid.gain.value = 0;

      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = "highshelf";
      eqHigh.frequency.value = 10000;
      eqHigh.gain.value = 0;

      const filter = ctx.createBiquadFilter();
      filter.type = "allpass";

      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.28;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.34;
      const wet = ctx.createGain();
      wet.gain.value = 0;

      const gain = ctx.createGain();
      gain.gain.value = get().decks[deck].volume;
      const fade = ctx.createGain();
      fade.gain.value = deck === "a" ? crossfadeGains(get().crossfade).a : crossfadeGains(get().crossfade).b;

      source.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(filter);
      filter.connect(gain);
      // Echo runs as a parallel wet path so turning it up doesn't duck the dry
      // signal — the deck stays as loud as the fader says it is.
      filter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(gain);

      gain.connect(fade);
      fade.connect(out);

      Object.assign(chain, { source, eqLow, eqMid, eqHigh, filter, delay, feedback, wet, gain, fade });
      set({ audioGraphReady: true });
      return true;
    } catch (error) {
      console.warn(`[dj] deck ${deck} could not be routed through Web Audio`, error);
      return false;
    }
  }

  function applyRate(deck: DeckId) {
    const chain = chains[deck];
    if (!chain) return;
    const { tempo, keylock } = get().decks[deck];
    const element = chain.element as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    element.preservesPitch = keylock;
    element.mozPreservesPitch = keylock;
    element.webkitPreservesPitch = keylock;
    element.playbackRate = 1 + tempo;
  }

  function applyVolumes() {
    const { crossfade, decks, masterVolume } = get();
    const gains = crossfadeGains(crossfade);

    for (const deck of ["a", "b"] as DeckId[]) {
      const chain = chains[deck];
      if (!chain) continue;
      const fadeGain = deck === "a" ? gains.a : gains.b;

      if (chain.gain && chain.fade) {
        chain.gain.gain.value = decks[deck].volume;
        chain.fade.gain.value = fadeGain;
        chain.element.volume = 1;
      } else {
        // Basic mode: fold deck volume, crossfade and master into the element.
        chain.element.volume = clamp(decks[deck].volume * fadeGain * masterVolume, 0, 1);
      }
    }
    if (master) master.gain.value = masterVolume;
  }

  function startTicking(deck: DeckId) {
    const chain = chains[deck];
    if (!chain || chain.raf != null) return;

    const loop = () => {
      const current = chains[deck];
      if (!current) return;

      const { loop: region } = get().decks[deck];
      // Loop wrap-around is checked on the animation frame rather than with a
      // timer, so it stays accurate when the tempo fader is moved mid-loop.
      if (region && current.element.currentTime >= region.end) {
        current.element.currentTime = region.start;
      }

      patch(deck, {
        currentTime: current.element.currentTime,
        duration: Number.isFinite(current.element.duration)
          ? current.element.duration
          : get().decks[deck].duration,
      });
      current.raf = requestAnimationFrame(loop);
    };
    chain.raf = requestAnimationFrame(loop);
  }

  function stopTicking(deck: DeckId) {
    const chain = chains[deck];
    if (chain?.raf != null) {
      cancelAnimationFrame(chain.raf);
      chain.raf = null;
    }
  }

  function destroyChain(deck: DeckId) {
    const chain = chains[deck];
    if (!chain) return;
    stopTicking(deck);
    chain.analysisAbort?.abort();
    chain.element.pause();
    chain.element.removeAttribute("src");
    chain.element.load();
    try {
      chain.source?.disconnect();
      chain.eqLow?.disconnect();
      chain.eqMid?.disconnect();
      chain.eqHigh?.disconnect();
      chain.filter?.disconnect();
      chain.delay?.disconnect();
      chain.feedback?.disconnect();
      chain.wet?.disconnect();
      chain.gain?.disconnect();
      chain.fade?.disconnect();
    } catch {
      // Disconnecting an already-torn-down node is not worth reporting.
    }
    chains[deck] = null;
  }

  /**
   * Loads a source, preferring a CORS-readable request so the effects rack
   * works. Resolves to whether cross-origin reads were permitted.
   */
  function loadElement(element: HTMLAudioElement, url: string) {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const attempt = (withCors: boolean) => {
        const onLoaded = () => {
          cleanup();
          if (!settled) {
            settled = true;
            resolve(withCors);
          }
        };
        const onError = () => {
          cleanup();
          if (settled) return;
          if (withCors) {
            // Almost always a missing Access-Control-Allow-Origin header.
            attempt(false);
          } else {
            settled = true;
            resolve(false);
          }
        };
        const cleanup = () => {
          element.removeEventListener("loadedmetadata", onLoaded);
          element.removeEventListener("error", onError);
        };

        element.addEventListener("loadedmetadata", onLoaded);
        element.addEventListener("error", onError);

        if (withCors) element.crossOrigin = "anonymous";
        else element.removeAttribute("crossorigin");
        element.src = url;
        element.load();
      };

      attempt(true);
    });
  }

  return {
    decks: { a: emptyDeck(), b: emptyDeck() },
    crossfade: 0.5,
    masterVolume: 0.9,
    audioGraphReady: false,
    sessionStartedAt: null,
    recording: {
      active: false,
      startedAt: null,
      url: null,
      mimeType: null,
      error: null,
    },

    loadDeck: async (deck, song) => {
      destroyChain(deck);
      set((state) => ({
        decks: {
          ...state.decks,
          [deck]: { ...emptyDeck(), song, loading: true, volume: state.decks[deck].volume },
        },
        sessionStartedAt: state.sessionStartedAt ?? Date.now(),
      }));

      const element = new Audio();
      element.preload = "auto";
      element.setAttribute("aria-hidden", "true");

      const chain: Chain = {
        element,
        source: null,
        eqLow: null,
        eqMid: null,
        eqHigh: null,
        filter: null,
        delay: null,
        feedback: null,
        wet: null,
        gain: null,
        fade: null,
        raf: null,
        analysisAbort: null,
      };
      chains[deck] = chain;

      element.addEventListener("ended", () => {
        patch(deck, { playing: false });
        stopTicking(deck);
      });

      const corsAllowed = await loadElement(element, song.audioUrl);

      // The deck may have been ejected or replaced while the file loaded.
      if (chains[deck] !== chain) return;

      if (!Number.isFinite(element.duration) || element.duration === 0) {
        if (element.error) {
          patch(deck, {
            loading: false,
            ready: false,
            error: "This track couldn't be loaded onto the deck.",
          });
          return;
        }
      }

      const effectsAvailable = corsAllowed && connectGraph(deck, chain);

      patch(deck, {
        loading: false,
        ready: true,
        effectsAvailable,
        duration: Number.isFinite(element.duration) ? element.duration : song.durationSec,
        bpm: song.bpm,
        bpmSource: song.bpm ? "metadata" : null,
        analysing: corsAllowed,
        analysisNote: corsAllowed
          ? null
          : "This track's host blocks cross-origin reads, so the effects rack and waveform are unavailable. Transport, tempo and crossfading still work.",
      });

      applyRate(deck);
      applyVolumes();

      if (!corsAllowed) return;

      // Waveform + tempo detection. Non-blocking: the deck is playable already.
      const abort = new AbortController();
      chain.analysisAbort = abort;

      analyseTrack(song.audioUrl, 900, abort.signal)
        .then((analysis) => {
          if (chains[deck] !== chain) return;
          patch(deck, {
            peaks: analysis.peaks,
            analysing: false,
            duration: analysis.durationSec || get().decks[deck].duration,
            ...(song.bpm
              ? {}
              : analysis.bpm
                ? { bpm: analysis.bpm, bpmSource: "detected" as const }
                : {}),
          });
        })
        .catch((error) => {
          if (chains[deck] !== chain || abort.signal.aborted) return;
          patch(deck, {
            analysing: false,
            analysisNote:
              error instanceof AnalysisUnavailableError
                ? error.message
                : "Couldn't analyse this track's waveform.",
          });
        });
    },

    ejectDeck: (deck) => {
      destroyChain(deck);
      set((state) => ({
        decks: {
          ...state.decks,
          [deck]: { ...emptyDeck(), volume: state.decks[deck].volume },
        },
      }));
    },

    togglePlay: (deck) => {
      const chain = chains[deck];
      if (!chain) return;
      ensureContext();

      if (get().decks[deck].playing) {
        chain.element.pause();
        patch(deck, { playing: false });
        stopTicking(deck);
        return;
      }

      void chain.element
        .play()
        .then(() => {
          patch(deck, { playing: true, error: null });
          startTicking(deck);
        })
        .catch(() => {
          patch(deck, {
            playing: false,
            error: "The browser blocked playback — press play again.",
          });
        });
    },

    /** CDJ behaviour: pressing cue while stopped jumps back to the cue point. */
    cue: (deck) => {
      const chain = chains[deck];
      if (!chain) return;
      const { cuePoint, playing } = get().decks[deck];
      if (playing) {
        chain.element.pause();
        patch(deck, { playing: false });
        stopTicking(deck);
      }
      chain.element.currentTime = cuePoint;
      patch(deck, { currentTime: cuePoint });
    },

    setCuePoint: (deck) => {
      const chain = chains[deck];
      if (!chain) return;
      patch(deck, { cuePoint: chain.element.currentTime });
    },

    seek: (deck, seconds) => {
      const chain = chains[deck];
      if (!chain) return;
      const duration = Number.isFinite(chain.element.duration)
        ? chain.element.duration
        : get().decks[deck].duration;
      const target = clamp(seconds, 0, Math.max(0, duration));
      chain.element.currentTime = target;
      patch(deck, { currentTime: target });
    },

    nudge: (deck, seconds) => {
      const chain = chains[deck];
      if (!chain) return;
      get().seek(deck, chain.element.currentTime + seconds);
    },

    setTempo: (deck, tempo) => {
      patch(deck, { tempo: clamp(tempo, -DJ_PITCH_RANGE, DJ_PITCH_RANGE) });
      applyRate(deck);
    },

    resetTempo: (deck) => {
      patch(deck, { tempo: 0 });
      applyRate(deck);
    },

    setKeylock: (deck, keylock) => {
      patch(deck, { keylock });
      applyRate(deck);
    },

    setVolume: (deck, volume) => {
      patch(deck, { volume: clamp(volume, 0, 1) });
      applyVolumes();
    },

    setFilter: (deck, value) => {
      const amount = clamp(value, -1, 1);
      patch(deck, { filter: amount });

      const chain = chains[deck];
      if (!chain?.filter) return;

      if (Math.abs(amount) < 0.02) {
        chain.filter.type = "allpass";
        return;
      }
      if (amount < 0) {
        // Sweep the low-pass corner logarithmically: linear Hz would spend most
        // of the knob's travel in a range the ear barely registers.
        chain.filter.type = "lowpass";
        chain.filter.frequency.value = 20_000 * Math.pow(0.0015, -amount);
      } else {
        chain.filter.type = "highpass";
        chain.filter.frequency.value = 20 * Math.pow(500, amount);
      }
      chain.filter.Q.value = 0.9;
    },

    setEqLow: (deck, value) => {
      const v = clamp(value, -1, 1);
      patch(deck, { eqLow: v });
      const chain = chains[deck];
      if (chain?.eqLow) chain.eqLow.gain.value = v <= -0.95 ? -60 : v * 12;
    },

    setEqMid: (deck, value) => {
      const v = clamp(value, -1, 1);
      patch(deck, { eqMid: v });
      const chain = chains[deck];
      if (chain?.eqMid) chain.eqMid.gain.value = v <= -0.95 ? -60 : v * 12;
    },

    setEqHigh: (deck, value) => {
      const v = clamp(value, -1, 1);
      patch(deck, { eqHigh: v });
      const chain = chains[deck];
      if (chain?.eqHigh) chain.eqHigh.gain.value = v <= -0.95 ? -60 : v * 12;
    },

    setHotCue: (deck, index) => {
      const chain = chains[deck];
      if (!chain) return;
      const newCues = [...get().decks[deck].hotCues];
      newCues[index] = chain.element.currentTime;
      patch(deck, { hotCues: newCues });
    },

    jumpToHotCue: (deck, index) => {
      const chain = chains[deck];
      if (!chain) return;
      const time = get().decks[deck].hotCues[index];
      if (time === null) {
        const newCues = [...get().decks[deck].hotCues];
        newCues[index] = chain.element.currentTime;
        patch(deck, { hotCues: newCues });
      } else {
        chain.element.currentTime = time;
        patch(deck, { currentTime: time });
      }
    },

    clearHotCue: (deck, index) => {
      const newCues = [...get().decks[deck].hotCues];
      newCues[index] = null;
      patch(deck, { hotCues: newCues });
    },

    sync: (deck) => {
      const other: DeckId = deck === "a" ? "b" : "a";
      const myBpm = get().decks[deck].bpm;
      const otherBpm = get().decks[other].bpm;
      const otherTempo = get().decks[other].tempo;
      if (!myBpm || !otherBpm) return;
      const targetBpm = otherBpm * (1 + otherTempo);
      const newTempo = clamp(targetBpm / myBpm - 1, -DJ_PITCH_RANGE, DJ_PITCH_RANGE);
      patch(deck, { tempo: newTempo });
      applyRate(deck);
    },

    setEcho: (deck, value) => {
      const amount = clamp(value, 0, 1);
      patch(deck, { echo: amount });
      const chain = chains[deck];
      if (!chain?.wet || !chain.feedback) return;
      chain.wet.gain.value = amount * 0.8;
      chain.feedback.gain.value = 0.2 + amount * 0.35;
    },

    setLoopIn: (deck) => {
      const chain = chains[deck];
      if (!chain) return;
      const start = chain.element.currentTime;
      const existing = get().decks[deck].loop;
      patch(deck, {
        loop: { start, end: existing && existing.end > start ? existing.end : start + 4 },
      });
    },

    setLoopOut: (deck) => {
      const chain = chains[deck];
      if (!chain) return;
      const end = chain.element.currentTime;
      const existing = get().decks[deck].loop;
      const start = existing?.start ?? Math.max(0, end - 4);
      if (end <= start + 0.1) return;
      patch(deck, { loop: { start, end } });
    },

    clearLoop: (deck) => patch(deck, { loop: null }),

    setCrossfade: (value) => {
      set({ crossfade: clamp(value, 0, 1) });
      applyVolumes();
    },

    setMasterVolume: (value) => {
      set({ masterVolume: clamp(value, 0, 1) });
      applyVolumes();
    },

    startRecording: () => {
      const { context: ctx, master: out } = ensureContext();

      if (typeof MediaRecorder === "undefined") {
        set({
          recording: {
            ...get().recording,
            error: "This browser can't record audio.",
          },
        });
        return;
      }

      try {
        recorderDestination ??= ctx.createMediaStreamDestination();
        out.connect(recorderDestination);

        const mimeType = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
        ].find((type) => MediaRecorder.isTypeSupported(type));

        chunks = [];
        recorder = new MediaRecorder(
          recorderDestination.stream,
          mimeType ? { mimeType } : undefined,
        );
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          const type = recorder?.mimeType || mimeType || "audio/webm";
          const blob = new Blob(chunks, { type });
          chunks = [];
          const previous = get().recording.url;
          if (previous) URL.revokeObjectURL(previous);
          set({
            recording: {
              active: false,
              startedAt: null,
              url: URL.createObjectURL(blob),
              mimeType: type,
              error: null,
            },
          });
        };
        recorder.start();

        set({
          recording: {
            active: true,
            startedAt: Date.now(),
            url: null,
            mimeType: mimeType ?? null,
            error: null,
          },
        });
      } catch (error) {
        console.error("[dj] recording failed to start", error);
        set({
          recording: {
            ...get().recording,
            active: false,
            error: "Couldn't start recording on this device.",
          },
        });
      }
    },

    stopRecording: () => {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorder = null;
    },

    discardRecording: () => {
      const { url } = get().recording;
      if (url) URL.revokeObjectURL(url);
      set({
        recording: { active: false, startedAt: null, url: null, mimeType: null, error: null },
      });
    },

    teardown: () => {
      const { recording, decks, sessionStartedAt } = get();

      // Report the finished mix before tearing everything down, so the admin
      // dashboard's "DJ panel usage" figure reflects real sessions.
      if (sessionStartedAt && (decks.a.song || decks.b.song)) {
        void fetch("/api/dj/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deckASongId: decks.a.song?.id ?? null,
            deckBSongId: decks.b.song?.id ?? null,
            durationSec: Math.round((Date.now() - sessionStartedAt) / 1000),
          }),
          keepalive: true,
        }).catch(() => {});
      }

      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorder = null;
      if (recording.url) URL.revokeObjectURL(recording.url);

      destroyChain("a");
      destroyChain("b");
      recorderDestination = null;
      master = null;
      void context?.close();
      context = null;

      set({
        decks: { a: emptyDeck(), b: emptyDeck() },
        crossfade: 0.5,
        audioGraphReady: false,
        sessionStartedAt: null,
        recording: {
          active: false,
          startedAt: null,
          url: null,
          mimeType: null,
          error: null,
        },
      });
    },
  };
});
