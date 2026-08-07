/**
 * Chart colours for the admin dashboard.
 *
 * Single-series charts use the app accent, which is not a categorical
 * assignment — nothing has to be told apart from anything else, so brand
 * consistency wins.
 *
 * `MODE_COLORS` is the one genuinely categorical set on the page (player /
 * karaoke / DJ). It is *not* the app's violet-cyan-amber trio: those three sit
 * outside the lightness band for a dark surface and read as a gradient rather
 * than three identities. These three were validated as a set against the
 * `--color-surface` background (#12121c) for lightness band, chroma floor,
 * colour-vision-deficiency separation, normal-vision separation and contrast,
 * on the all-pairs list. Each swatch also ships with a text label beside it, so
 * identity never rests on colour alone.
 *
 * Re-validate before changing any value here — order matters, and hues are
 * assigned to a fixed slot rather than cycled.
 */
export const MODE_COLORS = {
  player: "#3987e5",
  karaoke: "#d95926",
  dj: "#199e70",
} as const;

export const MODE_LABELS = {
  player: "Player",
  karaoke: "Karaoke",
  dj: "DJ booth",
} as const;

export type ListeningMode = keyof typeof MODE_COLORS;

export const LISTENING_MODES = ["player", "karaoke", "dj"] as const satisfies
  readonly ListeningMode[];
