"use client";

import {
  Lock,
  Music2,
  Pause,
  Play,
  RefreshCcw,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Target,
  Unplug,
  Unlock,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, IconButton } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/States";
import { DJ_PITCH_RANGE } from "@/lib/constants";
import { cn, formatDuration } from "@/lib/utils";
import { useDjStore, type DeckId } from "@/store/dj";
import { VinylPlatter } from "./VinylPlatter";
import { Waveform } from "./Waveform";

const ACCENTS: Record<DeckId, { hex: string }> = {
  a: { hex: "#a78bfa" },
  b: { hex: "#22d3ee" },
};

const HOT_CUE_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
];

const BEAT_SIZES: number[] = [0.5, 1, 2, 4, 8, 16];

/** One virtual CDJ deck: platter, transport, hot cues, loops and tempo. */
export function Deck({
  id,
  onPickTrack,
}: {
  id: DeckId;
  onPickTrack: () => void;
}) {
  const deck = useDjStore((s) => s.decks[id]);
  const store = useDjStore();
  const { hex: accentHex } = ACCENTS[id];

  const [pendingBeatLoop, setPendingBeatLoop] = useState<{
    beats: number;
    start: number;
    duration: number;
  } | null>(null);
  const [lockedBeatBeats, setLockedBeatBeats] = useState<number | null>(null);
  const [cueFlash, setCueFlash] = useState(false);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveBpm =
    deck.bpm != null ? Math.round(deck.bpm * (1 + deck.tempo) * 10) / 10 : null;
  const progress = deck.duration > 0 ? deck.currentTime / deck.duration : 0;
  const remaining = Math.max(0, deck.duration - deck.currentTime);

  // When playback reaches the beat-loop end point, the loop is now "locked" —
  // it has cycled at least once. Switch from the amber "pending" indicator to
  // the accent-coloured "active" indicator.
  useEffect(() => {
    if (!pendingBeatLoop) return;
    if (deck.currentTime >= pendingBeatLoop.start + pendingBeatLoop.duration) {
      setLockedBeatBeats(pendingBeatLoop.beats);
      setPendingBeatLoop(null);
    }
  }, [deck.currentTime, pendingBeatLoop]);

  // Mirror external loop clears (e.g. from the waveform) back into local state.
  useEffect(() => {
    if (!deck.loop) {
      setLockedBeatBeats(null);
      setPendingBeatLoop(null);
    }
  }, [deck.loop]);

  // Cleanup the CUE flash timer on unmount.
  useEffect(() => {
    return () => {
      if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    };
  }, []);

  /**
   * Set a beat-aligned loop. We write start+end directly into Zustand state so
   * the loop is correct from the very first tick — setLoopIn's 4-second default
   * end would cause short loops to fire at the wrong point before setLoopOut
   * could correct it.
   */
  function setBeatLoop(beats: number) {
    if (!deck.ready) return;
    const bpmToUse = deck.bpm ?? 120;
    const duration = (beats / bpmToUse) * 60;
    const start = deck.currentTime;
    const end = start + duration;
    useDjStore.setState((state) => ({
      decks: {
        ...state.decks,
        [id]: { ...state.decks[id], loop: { start, end } },
      },
    }));
    setLockedBeatBeats(null);
    setPendingBeatLoop({ beats, start, duration });
  }

  function handleCue() {
    store.cue(id);
    setCueFlash(true);
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    cueTimerRef.current = setTimeout(() => setCueFlash(false), 400);
  }

  function handleClearLoop() {
    store.clearLoop(id);
    setLockedBeatBeats(null);
    setPendingBeatLoop(null);
  }

  return (
    <section
      aria-label={`Deck ${id.toUpperCase()}`}
      className="flex flex-col gap-3 rounded-2xl border bg-[#111116] p-4"
      style={{ borderColor: deck.playing ? accentHex + "55" : "#2a2a35" }}
    >
      {/* ── 1. HEADER ── */}
      <header className="flex min-h-[2.5rem] items-center gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold tracking-wider"
          style={{
            borderColor: deck.playing ? accentHex : "#3a3a4a",
            color: deck.playing ? accentHex : "#666680",
          }}
        >
          {id.toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          {deck.song ? (
            <>
              <p className="truncate text-sm font-semibold leading-tight text-white/90">
                {deck.song.title}
              </p>
              <p className="mt-0.5 truncate text-xs leading-tight text-[#888899]">
                {deck.song.artist}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[#555570]">No track loaded</p>
              <p className="text-xs text-[#3a3a4a]">Load a track to get started</p>
            </>
          )}
        </div>

        {deck.song && (
          <IconButton
            label={`Eject deck ${id.toUpperCase()}`}
            size="sm"
            variant="ghost"
            className="text-[#555570] hover:text-white/70"
            onClick={() => store.ejectDeck(id)}
          >
            <Unplug className="size-4" aria-hidden="true" />
          </IconButton>
        )}
      </header>

      {/* Errors and analysis notices */}
      {deck.error && <InlineError message={deck.error} />}
      {deck.analysisNote && (
        <p className="rounded-lg border border-[#2a2a35] bg-[#1a1a22] px-3 py-2 text-xs leading-relaxed text-[#888899]">
          {deck.analysisNote}
        </p>
      )}

      {/* ── 2. WAVEFORM ── */}
      <Waveform
        peaks={deck.peaks}
        currentTime={deck.currentTime}
        duration={deck.duration}
        loop={deck.loop}
        cuePoint={deck.cuePoint}
        accent={accentHex}
        loading={deck.loading || deck.analysing}
        onSeek={(seconds) => store.seek(id, seconds)}
      />

      {/* ── 3. TIME ROW ── */}
      <div className="flex items-center gap-3 font-mono tabular-nums">
        <span className="text-xl font-bold tracking-tight" style={{ color: accentHex }}>
          {formatDuration(deck.currentTime)}
        </span>
        <div className="h-px flex-1 bg-[#2a2a35]" />
        <span className="text-sm text-[#555570]">-{formatDuration(remaining)}</span>
      </div>

      {/* ── 4. VINYL PLATTER ── */}
      <div className="flex justify-center py-1">
        <VinylPlatter
          playing={deck.playing}
          coverUrl={deck.song?.coverUrl ?? null}
          seed={deck.song?.title ?? id}
          accentColor={accentHex}
          progress={progress}
          onNudge={(delta) => store.nudge(id, delta)}
        />
      </div>

      {/* ── 5. HOT CUES ── */}
      <div className="grid grid-cols-8 gap-1" role="group" aria-label="Hot cues">
        {HOT_CUE_COLORS.map((color, i) => {
          const isSet = deck.hotCues[i] !== null;
          const time = deck.hotCues[i];
          return (
            <button
              key={i}
              type="button"
              title={
                isSet && time !== null
                  ? `Cue ${i + 1}: ${formatDuration(time)} — right-click to clear`
                  : `Set cue ${i + 1}`
              }
              aria-label={
                isSet && time !== null
                  ? `Jump to cue ${i + 1} at ${formatDuration(time)}`
                  : `Set cue ${i + 1}`
              }
              disabled={!deck.ready}
              onClick={() => {
                if (isSet) {
                  store.jumpToHotCue(id, i);
                } else {
                  store.setHotCue(id, i);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                store.clearHotCue(id, i);
              }}
              className="relative h-8 rounded border text-[10px] font-bold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-30"
              style={
                isSet
                  ? {
                      backgroundColor: color + "33",
                      borderColor: color + "80",
                      color: color,
                    }
                  : {
                      backgroundColor: "transparent",
                      borderColor: "#2a2a35",
                      color: "#444455",
                    }
              }
            >
              {i + 1}
              {isSet && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b"
                  style={{ backgroundColor: color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── 6. TRANSPORT ROW ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* CUE */}
        <button
          type="button"
          disabled={!deck.ready}
          onClick={handleCue}
          className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold tracking-widest transition-all hover:border-[#555570] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
          style={
            cueFlash
              ? { borderColor: "#22c55e80", backgroundColor: "#22c55e18", color: "#4ade80" }
              : { borderColor: "#3a3a4a", color: "#888899" }
          }
        >
          <Target className="size-3.5" aria-hidden="true" />
          CUE
        </button>

        {/* PLAY / PAUSE */}
        <button
          type="button"
          disabled={!deck.ready}
          onClick={() => store.togglePlay(id)}
          aria-label={
            deck.playing ? `Pause deck ${id.toUpperCase()}` : `Play deck ${id.toUpperCase()}`
          }
          className={cn(
            "grid size-[52px] shrink-0 place-items-center rounded-full transition-all active:scale-95",
            deck.ready
              ? "bg-green-500 text-black hover:bg-green-400"
              : "cursor-not-allowed bg-[#1a2a1a] text-green-900 opacity-40",
          )}
          style={
            deck.ready ? { boxShadow: "0 0 16px rgba(34,197,94,0.35)" } : undefined
          }
        >
          {deck.playing ? (
            <Pause className="size-5 fill-current" aria-hidden="true" />
          ) : (
            <Play className="size-5 translate-x-px fill-current" aria-hidden="true" />
          )}
        </button>

        {/* SYNC */}
        <button
          type="button"
          disabled={!deck.ready || !deck.bpm}
          onClick={() => store.sync(id)}
          title="Sync BPM to the other deck"
          className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold tracking-widest transition-all hover:bg-[#3b82f610] disabled:cursor-not-allowed disabled:opacity-30"
          style={{ borderColor: "#3b82f660", color: "#3b82f6" }}
        >
          <RefreshCcw className="size-3.5" aria-hidden="true" />
          SYNC
        </button>

        {/* NUDGE buttons */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={!deck.ready}
            onClick={() => store.nudge(id, -0.04)}
            aria-label="Nudge back"
            title="Nudge back"
            className="flex size-9 items-center justify-center rounded-lg border border-[#2a2a35] text-[#666680] transition-all hover:border-[#444460] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <SkipBack className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!deck.ready}
            onClick={() => store.nudge(id, 0.04)}
            aria-label="Nudge forward"
            title="Nudge forward"
            className="flex size-9 items-center justify-center rounded-lg border border-[#2a2a35] text-[#666680] transition-all hover:border-[#444460] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <SkipForward className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── 7. BPM + KEYLOCK ── */}
      <div className="flex items-center justify-between rounded-xl border border-[#2a2a35] bg-[#0d0d12] px-4 py-3">
        <div>
          <p className="mb-1 text-[0.6rem] uppercase tracking-widest text-[#555570]">BPM</p>
          <p
            className="font-mono text-3xl font-bold tabular-nums leading-none"
            style={{ color: accentHex }}
          >
            {effectiveBpm ?? "—"}
          </p>
          <p className="mt-1 text-[0.6rem] text-[#444455]">
            {deck.bpmSource === "detected"
              ? "detected"
              : deck.bpmSource === "metadata"
                ? "from metadata"
                : deck.analysing
                  ? "analysing…"
                  : "—"}
          </p>
        </div>

        {/* KEYLOCK toggle — styled as a pill so it reads as a hardware button */}
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={deck.keylock}
            onChange={(e) => store.setKeylock(id, e.target.checked)}
            className="sr-only"
          />
          <div
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all"
            style={
              deck.keylock
                ? {
                    borderColor: accentHex + "60",
                    backgroundColor: accentHex + "18",
                    color: accentHex,
                  }
                : { borderColor: "#2a2a35", color: "#555570" }
            }
          >
            {deck.keylock ? (
              <Lock className="size-3.5" aria-hidden="true" />
            ) : (
              <Unlock className="size-3.5" aria-hidden="true" />
            )}
            <Music2 className="size-3" aria-hidden="true" />
            <span className="text-[0.65rem] uppercase tracking-wider">Keylock</span>
          </div>
        </label>
      </div>

      {/* ── 8. PITCH / TEMPO FADER ── */}
      <div className="rounded-xl border border-[#2a2a35] bg-[#0d0d12] px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.6rem] uppercase tracking-widest text-[#555570]">Tempo</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => store.resetTempo(id)}
              title="Reset tempo to 0"
              className="text-[#555570] transition-colors hover:text-white/70"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
            </button>
            <span
              className="font-mono text-xs tabular-nums"
              style={{
                color: Math.abs(deck.tempo) > 0.001 ? "rgba(255,255,255,0.8)" : "#444455",
              }}
            >
              {deck.tempo >= 0 ? "+" : ""}
              {(deck.tempo * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="relative">
          {/* Centre-zero mark */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-[#3a3a4a]"
          />
          <input
            id={`tempo-${id}`}
            type="range"
            min={-DJ_PITCH_RANGE}
            max={DJ_PITCH_RANGE}
            step={0.001}
            value={deck.tempo}
            onChange={(e) => store.setTempo(id, Number(e.target.value))}
            aria-label={`Deck ${id.toUpperCase()} tempo`}
            aria-valuetext={`${(deck.tempo * 100).toFixed(1)} percent`}
            className="w-full"
            style={{
              ["--track" as string]:
                "linear-gradient(to right, var(--color-surface-3) 50%, var(--color-surface-3) 50%)",
            }}
          />
        </div>

        <div className="mt-1 flex justify-between">
          <span className="font-mono text-[0.6rem] text-[#333344]">
            -{Math.round(DJ_PITCH_RANGE * 100)}%
          </span>
          <span className="font-mono text-[0.6rem] text-[#333344]">
            +{Math.round(DJ_PITCH_RANGE * 100)}%
          </span>
        </div>
      </div>

      {/* ── 9. LOOP SECTION ── */}
      <div className="flex flex-col gap-2 rounded-xl border border-[#2a2a35] bg-[#0d0d12] p-3">
        {/* Beat-loop buttons */}
        <div className="flex items-center gap-1.5">
          <Repeat className="size-3.5 shrink-0 text-[#555570]" aria-hidden="true" />
          <div className="flex flex-1 gap-1">
            {BEAT_SIZES.map((beats) => {
              const isPending = pendingBeatLoop?.beats === beats;
              const isLocked = lockedBeatBeats === beats && !!deck.loop;
              const btnStyle = isPending
                ? { backgroundColor: "#92400e33", borderColor: "#f59e0b99", color: "#fbbf24" }
                : isLocked
                  ? { backgroundColor: accentHex + "22", borderColor: accentHex + "80", color: accentHex }
                  : { borderColor: "#2a2a35", color: "#555570" };
              return (
                <button
                  key={beats}
                  type="button"
                  disabled={!deck.ready}
                  onClick={() => setBeatLoop(beats)}
                  title={`${beats === 0.5 ? "½" : beats} beat loop`}
                  className={cn(
                    "h-8 flex-1 rounded border text-[10px] font-bold transition-all",
                    "disabled:cursor-not-allowed disabled:opacity-30",
                    isPending && "animate-pulse",
                  )}
                  style={btnStyle}
                >
                  {beats === 0.5 ? "½" : beats}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active loop range display */}
        {deck.loop && (
          <p
            className="font-mono text-[0.65rem] tabular-nums"
            style={{ color: accentHex }}
          >
            {formatDuration(deck.loop.start)} – {formatDuration(deck.loop.end)}
          </p>
        )}

        {/* Manual LOOP IN / LOOP OUT / Clear controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={!deck.ready}
            onClick={() => store.setLoopIn(id)}
            className="h-7 rounded border border-[#2a2a35] px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#666680] transition-all hover:border-[#444460] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Loop In
          </button>
          <button
            type="button"
            disabled={!deck.ready}
            onClick={() => store.setLoopOut(id)}
            className="h-7 rounded border border-[#2a2a35] px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#666680] transition-all hover:border-[#444460] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Loop Out
          </button>

          {deck.loop && (
            <button
              type="button"
              onClick={handleClearLoop}
              className="ml-auto h-7 rounded border border-red-500/30 px-2.5 text-[10px] font-bold text-red-400/70 transition-all hover:border-red-500/60 hover:text-red-400"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── 10. LOAD / CHANGE TRACK ── */}
      <Button
        variant={deck.song ? "secondary" : "ghost"}
        size="sm"
        onClick={onPickTrack}
        className="w-full justify-center text-xs uppercase tracking-widest"
        style={
          !deck.song
            ? { borderColor: accentHex + "55", color: accentHex, border: "1px solid" }
            : undefined
        }
      >
        {deck.song ? "Change Track" : "Load Track"}
      </Button>
    </section>
  );
}
