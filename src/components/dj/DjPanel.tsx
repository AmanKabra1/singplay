"use client";

import { Circle, Download, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/States";
import { cn } from "@/lib/utils";
import { useDjStore, type DeckId } from "@/store/dj";
import { Deck } from "./Deck";
import { TrackPicker } from "./TrackPicker";

// ---------------------------------------------------------------------------
// Value formatters
// ---------------------------------------------------------------------------

function eqDbLabel(value: number): string {
  if (value <= -0.95) return "KILL";
  if (Math.abs(value) < 0.025) return "+0 dB";
  const db = Math.round(value * 12);
  return `${db > 0 ? "+" : ""}${db} dB`;
}

function filterLabel(value: number): string {
  if (Math.abs(value) < 0.025) return "OFF";
  return value < 0 ? "LP" : "HP";
}

function echoLabel(value: number): string {
  if (value < 0.01) return "OFF";
  return `${Math.round(value * 100)}%`;
}

// ---------------------------------------------------------------------------
// RotaryKnob
//
// A circular drag control that maps its value range onto -135° … +135°
// rotation. Up drag increases the value; double-click resets to 0.
// ---------------------------------------------------------------------------

interface RotaryKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** Short label displayed above the knob (e.g. "HI") */
  label: string;
  /** CSS hex color for the indicator line and focus ring */
  color: string;
  /** Value → display string shown below the knob */
  formatValue: (v: number) => string;
  /** Vertical pixels of drag that covers the full range (default 100) */
  sensitivity?: number;
}

function RotaryKnob({
  value,
  min,
  max,
  onChange,
  label,
  color,
  formatValue,
  sensitivity = 100,
}: RotaryKnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);

  // Map value → rotation angle
  const fraction = max === min ? 0.5 : (value - min) / (max - min);
  const rotation = -135 + fraction * 270;

  const clampChange = useCallback(
    (raw: number) => {
      onChange(Math.max(min, Math.min(max, raw)));
    },
    [min, max, onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startValue: value };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [value],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const deltaY = dragRef.current.startY - e.clientY;
      const range = max - min;
      clampChange(dragRef.current.startValue + (deltaY / sensitivity) * range);
    },
    [clampChange, max, min, sensitivity],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Double-click resets to the neutral position (0, clamped to [min, max])
  const handleDoubleClick = useCallback(() => {
    onChange(Math.max(min, Math.min(max, 0)));
  }, [onChange, min, max]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const small = (max - min) / 40;
      const large = (max - min) / 10;
      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          e.preventDefault();
          clampChange(value + (e.shiftKey ? large : small));
          break;
        case "ArrowDown":
        case "ArrowLeft":
          e.preventDefault();
          clampChange(value - (e.shiftKey ? large : small));
          break;
        case "PageUp":
          e.preventDefault();
          clampChange(value + large);
          break;
        case "PageDown":
          e.preventDefault();
          clampChange(value - large);
          break;
        case "Home":
          e.preventDefault();
          onChange(min);
          break;
        case "End":
          e.preventDefault();
          onChange(max);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          onChange(Math.max(min, Math.min(max, 0)));
          break;
      }
    },
    [value, min, max, clampChange, onChange],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      {/* Row label */}
      <span
        style={{
          fontSize: "0.52rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#6e6c8c",
          fontWeight: 600,
        }}
      >
        {label}
      </span>

      {/* Knob face */}
      <div
        ref={divRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={parseFloat(value.toFixed(3))}
        aria-label={label}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (divRef.current) {
            divRef.current.style.boxShadow = [
              "inset 0 2px 5px rgba(0,0,0,0.7)",
              "inset 0 -1px 2px rgba(255,255,255,0.05)",
              "0 3px 8px rgba(0,0,0,0.6)",
              `0 0 0 2px ${color}55`,
            ].join(", ");
          }
        }}
        onBlur={() => {
          if (divRef.current) {
            divRef.current.style.boxShadow = [
              "inset 0 2px 5px rgba(0,0,0,0.7)",
              "inset 0 -1px 2px rgba(255,255,255,0.05)",
              "0 3px 8px rgba(0,0,0,0.6)",
            ].join(", ");
          }
        }}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          position: "relative",
          cursor: "ns-resize",
          userSelect: "none",
          touchAction: "none",
          flexShrink: 0,
          outline: "none",
          // Knob face: beveled radial gradient — lighter top-left, very dark
          background:
            "radial-gradient(circle at 38% 35%, #26263d, #09090f)",
          border: "1.5px solid #3a3a55",
          boxShadow: [
            "inset 0 2px 5px rgba(0,0,0,0.7)",
            "inset 0 -1px 2px rgba(255,255,255,0.05)",
            "0 3px 8px rgba(0,0,0,0.6)",
          ].join(", "),
        }}
      >
        {/* Rotating indicator */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {/* Indicator line — a short bright rectangle near the rim */}
          <div
            style={{
              position: "absolute",
              top: 3,
              left: "50%",
              width: 3,
              height: 9,
              borderRadius: "2px 2px 1px 1px",
              transform: "translateX(-50%)",
              background: color,
              boxShadow: `0 0 6px ${color}90`,
            }}
          />
        </div>

        {/* Subtle outer arc (decorative) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: `1px solid ${color}1a`,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Value readout */}
      <span
        style={{
          fontSize: "0.48rem",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.02em",
          color: "#5a5878",
          minWidth: 34,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {formatValue(value)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChannelStrip
//
// One vertical mixer channel: label pill → EQ section (HI/MID/LOW) →
// FX section (FILTER/ECHO) → channel fader.
// ---------------------------------------------------------------------------

interface ChannelStripProps {
  id: DeckId;
  /** "CH-A" or "CH-B" */
  label: string;
  /** Accent hex color */
  color: string;
}

function ChannelStrip({ id, label, color }: ChannelStripProps) {
  const eqHigh = useDjStore((s) => s.decks[id].eqHigh);
  const eqMid = useDjStore((s) => s.decks[id].eqMid);
  const eqLow = useDjStore((s) => s.decks[id].eqLow);
  const filter = useDjStore((s) => s.decks[id].filter);
  const echo = useDjStore((s) => s.decks[id].echo);
  const volume = useDjStore((s) => s.decks[id].volume);

  const setEqHigh = useDjStore((s) => s.setEqHigh);
  const setEqMid = useDjStore((s) => s.setEqMid);
  const setEqLow = useDjStore((s) => s.setEqLow);
  const setFilter = useDjStore((s) => s.setFilter);
  const setEcho = useDjStore((s) => s.setEcho);
  const setVolume = useDjStore((s) => s.setVolume);

  // Track height in px (input height minus top/bottom padding of 8px each)
  const faderTrackPx = 112;
  const faderContainerPx = faderTrackPx + 16; // 128px

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "10px 8px 12px",
        borderRadius: 12,
        background: "linear-gradient(180deg, #111120 0%, #0b0b16 100%)",
        border: `1px solid ${color}28`,
        boxShadow: `0 0 24px ${color}07, inset 0 1px 0 rgba(255,255,255,0.04)`,
        minWidth: 72,
        flex: 1,
      }}
    >
      {/* Channel label pill */}
      <div
        style={{
          padding: "1px 8px 2px",
          borderRadius: 4,
          fontSize: "0.58rem",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color,
          background: `${color}14`,
          border: `1px solid ${color}40`,
          textShadow: `0 0 10px ${color}55`,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      {/* ── EQ section ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "7px 6px",
          background: "#080810",
          borderRadius: 8,
          border: "1px solid #1a1a2a",
        }}
      >
        <RotaryKnob
          value={eqHigh}
          min={-1}
          max={1}
          onChange={(v) => setEqHigh(id, v)}
          label="HI"
          color={color}
          formatValue={eqDbLabel}
        />
        <RotaryKnob
          value={eqMid}
          min={-1}
          max={1}
          onChange={(v) => setEqMid(id, v)}
          label="MID"
          color={color}
          formatValue={eqDbLabel}
        />
        <RotaryKnob
          value={eqLow}
          min={-1}
          max={1}
          onChange={(v) => setEqLow(id, v)}
          label="LOW"
          color={color}
          formatValue={eqDbLabel}
        />
      </div>

      {/* ── FX section ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "7px 6px",
          background: "#080810",
          borderRadius: 8,
          border: "1px solid #1a1a2a",
        }}
      >
        {/* FILTER: -1 (LP) to +1 (HP) */}
        <RotaryKnob
          value={filter}
          min={-1}
          max={1}
          onChange={(v) => setFilter(id, v)}
          label="FLT"
          color="#22d3ee"
          formatValue={filterLabel}
        />
        {/* ECHO: 0 (off) to 1 (full wet) */}
        <RotaryKnob
          value={echo}
          min={0}
          max={1}
          onChange={(v) => setEcho(id, v)}
          label="ECHO"
          color="#fbbf24"
          formatValue={echoLabel}
        />
      </div>

      {/* ── Channel fader ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        {/* Container gives the fader a fixed height */}
        <div
          style={{
            position: "relative",
            width: 32,
            height: faderContainerPx,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Decorative fader track groove */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 8,
              bottom: 8,
              left: "50%",
              width: 4,
              transform: "translateX(-50%)",
              background: "#07070e",
              borderRadius: 2,
              border: "1px solid #222230",
              boxShadow: "inset 0 2px 6px rgba(0,0,0,0.9)",
            }}
          />

          {/* Decorative fill: grows upward with volume */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              width: 4,
              height: `${faderTrackPx * volume}px`,
              transform: "translateX(-50%)",
              background: `linear-gradient(to top, ${color}, ${color}50)`,
              borderRadius: 2,
              opacity: 0.45,
              transition: "height 0.05s",
            }}
          />

          {/*
            Actual range input — rotated 90° counterclockwise so the thumb
            moves vertically. Moving up = higher value (correct CDJ fader feel).
            The fader-vertical CSS class is defined in globals.css.
          */}
          <input
            type="range"
            className="fader-vertical"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(id, Number(e.target.value))}
            aria-label={`${label} channel volume`}
            style={{
              // Constrain the range input to the container's full height
              height: "100%",
            }}
          />
        </div>

        <span
          style={{
            fontSize: "0.48rem",
            fontFamily: "ui-monospace, monospace",
            color: "#5a5878",
          }}
        >
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mixer
//
// The center panel between the two decks: channel strips, crossfader, master.
// On narrow screens it sits below both decks (order-last); on xl it is sticky
// between them (order-none).
// ---------------------------------------------------------------------------

function Mixer() {
  const crossfade = useDjStore((s) => s.crossfade);
  const masterVolume = useDjStore((s) => s.masterVolume);
  const setCrossfade = useDjStore((s) => s.setCrossfade);
  const setMasterVolume = useDjStore((s) => s.setMasterVolume);

  return (
    <section
      aria-label="Mixer"
      className="order-last xl:order-0 xl:sticky xl:top-24"
      style={{
        background: "linear-gradient(175deg, #0e0e1d 0%, #080811 100%)",
        border: "1px solid #232336",
        borderRadius: 16,
        boxShadow: [
          "0 8px 48px rgba(0,0,0,0.75)",
          "inset 0 1px 0 rgba(255,255,255,0.05)",
          "inset 0 -1px 0 rgba(0,0,0,0.5)",
        ].join(", "),
        padding: "12px 10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* ── Title rule ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, #2a2a3e)" }}
        />
        <span
          style={{
            fontSize: "0.52rem",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#5a5878",
            fontWeight: 700,
          }}
        >
          MIXER
        </span>
        <div
          style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, #2a2a3e)" }}
        />
      </div>

      {/* ── Channel strips (CH-A | CH-B) ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
        }}
      >
        <ChannelStrip id="a" label="CH-A" color="#8b5cf6" />
        <ChannelStrip id="b" label="CH-B" color="#22d3ee" />
      </div>

      {/* ── Crossfader ── */}
      <div
        style={{
          padding: "10px 10px 8px",
          background: "#07070e",
          borderRadius: 10,
          border: "1px solid #1a1a2a",
        }}
      >
        {/* A / CROSSFADER / B header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "#8b5cf6",
              textShadow: "0 0 12px #8b5cf670",
            }}
          >
            A
          </span>
          <span
            style={{
              fontSize: "0.48rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#5a5878",
            }}
          >
            CROSSFADER
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "#22d3ee",
              textShadow: "0 0 12px #22d3ee70",
            }}
          >
            B
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={crossfade}
          onChange={(e) => setCrossfade(Number(e.target.value))}
          aria-label="Crossfader"
          aria-valuetext={
            crossfade < 0.45
              ? `${Math.round((1 - crossfade) * 100)} percent deck A`
              : crossfade > 0.55
                ? `${Math.round(crossfade * 100)} percent deck B`
                : "centred"
          }
          className="w-full"
          style={{
            ["--track" as string]:
              "linear-gradient(to right, #8b5cf6 0%, #4c1d95 35%, #18183a 50%, #0a3f50 65%, #22d3ee 100%)",
          }}
        />

        <div
          style={{
            marginTop: 6,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => setCrossfade(0.5)}
            style={{
              fontSize: "0.48rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#5a5878",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "3px 12px",
              borderRadius: 4,
            }}
            className="transition-colors hover:text-text"
          >
            CENTRE
          </button>
        </div>
      </div>

      {/* ── Master volume ── */}
      <div
        style={{
          padding: "8px 10px 8px",
          background: "#07070e",
          borderRadius: 10,
          border: "1px solid #1a1a2a",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <label
            htmlFor="dj-master-volume"
            style={{
              fontSize: "0.52rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#5a5878",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            MASTER
          </label>
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.58rem",
              color: "#a2a0bd",
            }}
          >
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
        <input
          id="dj-master-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          className="w-full"
          style={{
            ["--track" as string]: `linear-gradient(to right, var(--color-text) ${masterVolume * 100}%, var(--color-surface-3) ${masterVolume * 100}%)`,
          }}
        />
      </div>

      {/* ── Tip ── */}
      <p
        style={{
          background: "#07070e",
          border: "1px solid #1a1a2a",
          borderRadius: 8,
          padding: "7px 10px",
          fontSize: "0.62rem",
          lineHeight: 1.55,
          color: "#5a5878",
        }}
      >
        Match BPM with the tempo faders, then sweep the crossfader on a phrase
        boundary. Double-click any knob to reset it.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// DjPanel — public export
// ---------------------------------------------------------------------------

/**
 * The DJ booth (brief §3.5).
 *
 * Layout: [DECK A] [MIXER] [DECK B] on xl+, vertical stack on narrower
 * viewports with the mixer below both decks so users can still read it on a
 * phone held in portrait.
 */
export function DjPanel() {
  const loadDeck = useDjStore((s) => s.loadDeck);
  const teardown = useDjStore((s) => s.teardown);
  const [picking, setPicking] = useState<DeckId | null>(null);

  // Releasing the audio graph on unmount also reports the session length, which
  // is what the admin dashboard's "DJ panel usage" figure is built from.
  useEffect(() => () => teardown(), [teardown]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-xl font-bold">DJ booth</h1>
          <p className="text-fluid-sm text-muted">
            Two decks, a crossfader and an effects rack — private to your session.
          </p>
        </div>
        <MixRecorder />
      </header>

      {/*
        Wide: Deck A | Mixer (sticky) | Deck B
        Narrow: Deck A stacks over Deck B, Mixer comes last (order-last on
        the Mixer section keeps it readable without shrinking the decks).
      */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem_minmax(0,1fr)] xl:items-start">
        <Deck id="a" onPickTrack={() => setPicking("a")} />
        <Mixer />
        <Deck id="b" onPickTrack={() => setPicking("b")} />
      </div>

      {picking && (
        <TrackPicker
          deck={picking}
          onClose={() => setPicking(null)}
          onPick={(song) => {
            void loadDeck(picking, song);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MixRecorder
//
// Captures the master bus. Only active once the Web Audio graph is up.
// The CC-licensing caveat is shown inline so users read it before downloading.
// ---------------------------------------------------------------------------

function MixRecorder() {
  const recording = useDjStore((s) => s.recording);
  const graphReady = useDjStore((s) => s.audioGraphReady);
  const start = useDjStore((s) => s.startRecording);
  const stop = useDjStore((s) => s.stopRecording);
  const discard = useDjStore((s) => s.discardRecording);

  // A ticking clock, rather than a stored elapsed count — the displayed value
  // is derived from it, so stopping the recording needs no state reset.
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!recording.active) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [recording.active]);

  const elapsed =
    recording.active && recording.startedAt
      ? Math.max(
          0,
          Math.floor(
            (Math.max(now, recording.startedAt) - recording.startedAt) / 1000,
          ),
        )
      : 0;

  const extension = recording.mimeType?.includes("mp4") ? "m4a" : "webm";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {recording.url && !recording.active && (
          <>
            <a
              href={recording.url}
              download={`singplay-mix.${extension}`}
              className="tap inline-flex items-center gap-2 rounded-xl border border-success/40 px-4 text-fluid-sm font-medium text-success transition-colors hover:bg-success/10"
            >
              <Download className="size-4" aria-hidden="true" />
              Download mix
            </a>
            <Button variant="ghost" size="sm" onClick={discard}>
              <Trash2 className="size-4" aria-hidden="true" />
              Discard
            </Button>
          </>
        )}

        <Button
          variant={recording.active ? "danger" : "secondary"}
          size="sm"
          disabled={!graphReady && !recording.active}
          onClick={() => (recording.active ? stop() : start())}
          title={
            graphReady
              ? undefined
              : "Load a deck from a source that allows recording first"
          }
        >
          {recording.active ? (
            <>
              <Square className="size-3.5 fill-current" aria-hidden="true" />
              Stop ({String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")})
            </>
          ) : (
            <>
              <Circle
                className={cn("size-3.5 fill-current text-danger")}
                aria-hidden="true"
              />
              Record mix
            </>
          )}
        </Button>
      </div>

      {recording.error && <InlineError message={recording.error} />}

      <p className="max-w-72 text-right text-[0.7rem] leading-relaxed text-faint">
        Recordings capture the master output. Creative Commons tracks stay under
        their own licence — keep the attribution if you share the mix.
      </p>
    </div>
  );
}
