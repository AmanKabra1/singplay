export const LANGUAGES = [
  "Hindi",
  "English",
  "Tamil",
  "Telugu",
  "Punjabi",
  "Gujarati",
  "Rajasthani",
  "Marathi",
  "Bengali",
  "Kannada",
  "Malayalam",
  "Korean",
  "Spanish",
  "Portuguese",
  "Arabic",
  "French",
] as const;

export const LANGUAGE_HUES: Record<string, number> = {
  Hindi: 10,
  English: 215,
  Tamil: 280,
  Telugu: 25,
  Punjabi: 48,
  Gujarati: 140,
  Rajasthani: 35,
  Marathi: 200,
  Bengali: 340,
  Kannada: 58,
  Malayalam: 168,
  Korean: 185,
  Spanish: 80,
  Portuguese: 120,
  Arabic: 38,
  French: 230,
};

export const GENRES = [
  "Pop",
  "Rock",
  "Hip Hop",
  "Electronic",
  "Jazz",
  "Classical",
  "Folk",
  "Metal",
  "Soul",
  "Reggae",
  "Country",
  "Lounge",
  "World",
  "Soundtrack",
] as const;

export const MOODS = [
  "Happy",
  "Chill",
  "Energetic",
  "Romantic",
  "Melancholic",
  "Focus",
  "Party",
  "Workout",
] as const;

export const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;

/** Guests hear this many seconds before being asked to sign up. */
export const GUEST_PREVIEW_SECONDS = 30;

/** Karaoke practice speeds. `preservesPitch` keeps these from sounding chipmunky. */
export const KARAOKE_SPEEDS = [0.75, 0.9, 1] as const;

/** DJ deck tempo range, as a fraction. ±16% matches a classic CDJ. */
export const DJ_PITCH_RANGE = 0.16;

export const LYRIC_FONT_SIZES = [
  { label: "S", value: 1 },
  { label: "M", value: 1.25 },
  { label: "L", value: 1.6 },
  { label: "XL", value: 2 },
] as const;

export const SESSION_COOKIE = "sp_session";
