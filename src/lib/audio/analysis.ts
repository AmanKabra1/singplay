"use client";

/**
 * Offline analysis of a track: the amplitude envelope drawn as a waveform, and
 * a tempo estimate for beatmatching (brief §3.5).
 *
 * Both need the decoded samples, which means downloading the file and running
 * it through `decodeAudioData`. That only works when the audio host allows
 * cross-origin reads — so every entry point here reports failure honestly
 * instead of inventing a waveform, and the UI falls back to a plain scrub bar.
 */

export type TrackAnalysis = {
  /** Normalised 0..1 peak per bucket, ready to draw. */
  peaks: Float32Array;
  durationSec: number;
  /** Null when the estimate wasn't confident enough to be worth showing. */
  bpm: number | null;
};

/** 60 MB of MP3 is ~10 minutes; past that, decoding cost isn't worth it. */
const MAX_BYTES = 60 * 1024 * 1024;

export class AnalysisUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisUnavailableError";
  }
}

export async function analyseTrack(
  url: string,
  bucketCount = 900,
  signal?: AbortSignal,
): Promise<TrackAnalysis> {
  let response: Response;
  try {
    response = await fetch(url, { mode: "cors", signal });
  } catch {
    throw new AnalysisUnavailableError(
      "This track's host doesn't allow the waveform to be read.",
    );
  }

  if (!response.ok) {
    throw new AnalysisUnavailableError(
      `Couldn't download this track for analysis (${response.status}).`,
    );
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    throw new AnalysisUnavailableError("This track is too large to analyse in the browser.");
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    throw new AnalysisUnavailableError("This track is too large to analyse in the browser.");
  }

  const context = new OfflineAudioContext(1, 1, 44_100);
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(bytes);
  } catch {
    throw new AnalysisUnavailableError("This audio format couldn't be decoded for analysis.");
  }

  return {
    peaks: computePeaks(buffer, bucketCount),
    durationSec: buffer.duration,
    bpm: estimateBpm(buffer),
  };
}

/** Per-bucket maximum absolute sample, normalised so the loudest bucket is 1. */
function computePeaks(buffer: AudioBuffer, bucketCount: number): Float32Array {
  const channel = buffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(channel.length / bucketCount));
  const peaks = new Float32Array(bucketCount);

  let loudest = 0;
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = bucket * bucketSize;
    const end = Math.min(start + bucketSize, channel.length);
    let peak = 0;
    // Stride through long buckets — sampling every 4th frame is visually
    // indistinguishable and keeps a 10-minute track responsive.
    for (let i = start; i < end; i += 4) {
      const value = Math.abs(channel[i]!);
      if (value > peak) peak = value;
    }
    peaks[bucket] = peak;
    if (peak > loudest) loudest = peak;
  }

  if (loudest > 0) {
    for (let i = 0; i < peaks.length; i++) peaks[i] = peaks[i]! / loudest;
  }
  return peaks;
}

/**
 * Tempo estimate by autocorrelation of the amplitude envelope.
 *
 * Good enough for beatmatching hints on rhythmic material, and it returns null
 * rather than a guess when the signal has no clear periodicity — a wrong BPM on
 * screen is worse than none.
 */
function estimateBpm(buffer: AudioBuffer): number | null {
  const sampleRate = buffer.sampleRate;
  const channel = buffer.getChannelData(0);

  // Downsample to a ~100 Hz envelope of positive energy differences (onsets).
  const windowSize = Math.floor(sampleRate / 100);
  const frameCount = Math.floor(channel.length / windowSize);
  if (frameCount < 400) return null;

  const energy = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    const start = frame * windowSize;
    let sum = 0;
    for (let i = start; i < start + windowSize; i += 2) {
      const value = channel[i]!;
      sum += value * value;
    }
    energy[frame] = Math.sqrt(sum / (windowSize / 2));
  }

  const onsets = new Float32Array(frameCount);
  for (let frame = 1; frame < frameCount; frame++) {
    onsets[frame] = Math.max(0, energy[frame]! - energy[frame - 1]!);
  }

  // 60–190 BPM covers essentially everything anyone beatmatches.
  const minLag = Math.floor((60 / 190) * 100);
  const maxLag = Math.ceil((60 / 60) * 100);

  let bestLag = 0;
  let bestScore = 0;
  let total = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    for (let frame = 0; frame + lag < frameCount; frame++) {
      score += onsets[frame]! * onsets[frame + lag]!;
    }
    score /= frameCount - lag;
    total += score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag === 0) return null;

  // Require the winning lag to stand clearly above the average correlation,
  // otherwise we're reading noise.
  const average = total / (maxLag - minLag + 1);
  if (average <= 0 || bestScore < average * 1.6) return null;

  let bpm = (60 * 100) / bestLag;
  // Fold octave errors into the range DJs actually read off a deck.
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  return Math.round(bpm * 10) / 10;
}
