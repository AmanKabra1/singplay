import type { LyricLine, SyncedLyrics } from "@/db/schema";

/**
 * LRC parsing / serialising.
 *
 * Supports:
 *   [mm:ss.xx] line              — standard LRC
 *   [mm:ss.xx][mm:ss.xx] line    — repeated lines (chorus)
 *   [00:12.00]<00:12.00>word ... — enhanced LRC with per-word timings
 *   [ti:], [ar:], [al:], [offset:] metadata tags
 */

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
const META_TAG = /^\[(ti|ar|al|au|by|offset|length|re|ve):(.*)\]$/i;

export type LrcMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  /** Milliseconds to shift every timestamp by. Negative = lyrics appear earlier. */
  offset?: number;
};

export type ParsedLrc = {
  metadata: LrcMetadata;
  lines: LyricLine[];
  plainText: string;
  /** Lines the parser could not read — surfaced to admins instead of swallowed. */
  warnings: string[];
};

function toSeconds(min: string, sec: string, frac?: string) {
  const fraction = frac ? Number(`0.${frac}`) : 0;
  return Number(min) * 60 + Number(sec) + fraction;
}

export function parseLrc(source: string): ParsedLrc {
  const metadata: LrcMetadata = {};
  const lines: LyricLine[] = [];
  const warnings: string[] = [];

  const rawLines = source.replace(/\r\n?/g, "\n").split("\n");

  for (const [index, raw] of rawLines.entries()) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const meta = META_TAG.exec(trimmed);
    if (meta) {
      const key = meta[1]!.toLowerCase();
      const value = meta[2]!.trim();
      if (key === "ti") metadata.title = value;
      else if (key === "ar") metadata.artist = value;
      else if (key === "al") metadata.album = value;
      else if (key === "offset") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) metadata.offset = parsed;
      }
      continue;
    }

    TIME_TAG.lastIndex = 0;
    const stamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastTagEnd = 0;
    while ((match = TIME_TAG.exec(trimmed)) !== null) {
      // Only leading timestamps count; a bracket mid-lyric is just text.
      if (match.index !== lastTagEnd) break;
      lastTagEnd = match.index + match[0].length;
      stamps.push(toSeconds(match[1]!, match[2]!, match[3]));
    }

    if (stamps.length === 0) {
      // A line with no timestamp is still lyric content in plain-text mode.
      if (!trimmed.startsWith("[")) {
        lines.push({ t: Number.NaN, text: trimmed });
      } else {
        warnings.push(`Line ${index + 1}: unrecognised tag "${trimmed}"`);
      }
      continue;
    }

    const body = trimmed.slice(lastTagEnd);
    const words = parseWordTimings(body);
    const text = body.replace(WORD_TAG, "").trim();

    for (const t of stamps) {
      lines.push(words ? { t, text, words } : { t, text });
    }
  }

  const offsetSec = (metadata.offset ?? 0) / 1000;
  const timed = lines.filter((l) => Number.isFinite(l.t));

  if (offsetSec !== 0) {
    for (const line of timed) {
      line.t = Math.max(0, line.t + offsetSec);
      if (line.words) {
        for (const w of line.words) w.t = Math.max(0, w.t + offsetSec);
      }
    }
  }

  timed.sort((a, b) => a.t - b.t);

  return {
    metadata,
    lines: timed,
    plainText: lines.map((l) => l.text).join("\n"),
    warnings,
  };
}

function parseWordTimings(body: string): LyricLine["words"] {
  WORD_TAG.lastIndex = 0;
  const out: { t: number; w: string }[] = [];
  let match: RegExpExecArray | null;
  let cursor = 0;
  let pendingTime: number | null = null;

  while ((match = WORD_TAG.exec(body)) !== null) {
    if (pendingTime !== null) {
      const word = body.slice(cursor, match.index).trim();
      if (word) out.push({ t: pendingTime, w: word });
    }
    pendingTime = toSeconds(match[1]!, match[2]!, match[3]);
    cursor = match.index + match[0].length;
  }

  if (pendingTime !== null) {
    const word = body.slice(cursor).trim();
    if (word) out.push({ t: pendingTime, w: word });
  }

  return out.length > 0 ? out : undefined;
}

function stamp(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = String(Math.floor(safe / 60)).padStart(2, "0");
  const s = String(Math.floor(safe % 60)).padStart(2, "0");
  const cs = String(Math.round((safe % 1) * 100)).padStart(2, "0");
  return `${m}:${s}.${cs}`;
}

/** Round-trips a timing map back to LRC so admins can edit what they uploaded. */
export function toLrc(synced: SyncedLyrics, metadata: LrcMetadata = {}) {
  const header: string[] = [];
  if (metadata.title) header.push(`[ti:${metadata.title}]`);
  if (metadata.artist) header.push(`[ar:${metadata.artist}]`);
  if (metadata.album) header.push(`[al:${metadata.album}]`);

  const body = synced.lines.map((line) => {
    if (line.words?.length) {
      const words = line.words.map((w) => `<${stamp(w.t)}>${w.w}`).join(" ");
      return `[${stamp(line.t)}]${words}`;
    }
    return `[${stamp(line.t)}]${line.text}`;
  });

  return [...header, ...body].join("\n");
}

/**
 * Index of the line that should be highlighted at `time`, or -1 before the
 * first line. Binary search so it stays cheap when called every animation frame.
 */
export function activeLineIndex(lines: LyricLine[], time: number) {
  if (lines.length === 0 || time < lines[0]!.t) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.t <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/** Index of the active word within a line, or -1. */
export function activeWordIndex(line: LyricLine | undefined, time: number) {
  if (!line?.words?.length) return -1;
  let result = -1;
  for (let i = 0; i < line.words.length; i++) {
    if (line.words[i]!.t <= time) result = i;
    else break;
  }
  return result;
}
