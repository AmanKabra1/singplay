/**
 * Development seed.
 *
 * Run with `npm run db:seed` after `npm run db:push`. Idempotent: every row is
 * keyed and skipped if it already exists, so running it twice is harmless.
 *
 * The audio it points at is the Wikimedia Commons copy of a public-domain
 * recording, so a fresh clone has something that genuinely plays without anyone
 * signing up for a catalog API first. Swap in your own uploads, or import the
 * Creative Commons catalog from the admin area, for anything beyond a smoke test.
 */
import { connect } from "@tidbcloud/serverless";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tidb-serverless";

import { parseLrc } from "../lib/lrc.ts";
import * as schema from "./schema.ts";

const { lyrics, songs, users } = schema;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in first.",
  );
  process.exit(1);
}

const db = drizzle(connect({ url: DATABASE_URL }), { schema });

/** A stable id per seed row keeps the script idempotent across runs. */
function seedId(slug: string) {
  return `seed-${slug}`.padEnd(36, "-").slice(0, 36);
}

const PUBLIC_DOMAIN_AUDIO =
  "https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg";

type SeedSong = {
  slug: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  mood: string;
  releaseYear: number;
  durationSec: number;
  bpm: number;
  musicalKey: string;
  notes: string;
  credits: string;
  /** Timed lyrics in LRC. Omit to seed a track with no sync, for the fallback path. */
  lrc?: string;
  plainText?: string;
};

const SEED_SONGS: SeedSong[] = [
  {
    slug: "midnight-signal",
    title: "Midnight Signal",
    artist: "Neon Harbour",
    album: "Long Wave",
    genre: "Electronic",
    mood: "Chill",
    releaseYear: 2023,
    durationSec: 212,
    bpm: 112,
    musicalKey: "A minor",
    notes:
      "Written in one sitting during a power cut — the demo was recorded on a phone by candlelight, and the final version keeps that first vocal take.",
    credits: "Words and music by Neon Harbour · Mixed by R. Okonkwo",
    lrc: `[ti:Midnight Signal]
[ar:Neon Harbour]
[al:Long Wave]

[00:04.00]Static on the long wave
[00:09.20]Somebody calling out my name
[00:14.60]Half a word, then nothing
[00:19.90]I keep the dial exactly where it came
[00:25.40]♪
[00:31.00]Midnight signal, carry me
[00:36.50]Over rooftops, out to sea
[00:42.00]If you're listening, leave a light
[00:47.60]I'll be tuning in all night`,
  },
  {
    slug: "paper-boats",
    title: "Paper Boats",
    artist: "Ilse Marchetti",
    album: "Small Weather",
    genre: "Folk",
    mood: "Melancholic",
    releaseYear: 1978,
    durationSec: 198,
    bpm: 84,
    musicalKey: "D major",
    notes:
      "A staple of the late-'70s coffee-house circuit. The recording you hear is the second pressing, which restored a verse the first release cut for length.",
    credits: "Written by I. Marchetti · Guitar by T. Vale",
    // Word-level timings, so the karaoke-ball highlight path gets exercised too.
    lrc: `[ti:Paper Boats]
[ar:Ilse Marchetti]

[00:06.00]<00:06.00>Folded <00:06.60>every <00:07.30>letter <00:08.10>into <00:08.80>boats
[00:12.40]<00:12.40>Set <00:12.90>them <00:13.40>on <00:13.90>the <00:14.30>rain
[00:18.80]<00:18.80>Watched <00:19.50>the <00:19.90>ink <00:20.50>run <00:21.20>into <00:21.90>blue
[00:26.10]<00:26.10>And <00:26.60>let <00:27.10>it <00:27.60>go <00:28.30>again`,
  },
  {
    slug: "brass-city-run",
    title: "Brass City Run",
    artist: "The Fourteenth Floor",
    album: "Uptown Cassette",
    genre: "Soul",
    mood: "Energetic",
    releaseYear: 1985,
    durationSec: 245,
    bpm: 126,
    musicalKey: "F minor",
    notes:
      "Built around a horn line the trumpet player improvised while the tape was rolling. Nobody wrote it down; every live version since has been slightly different.",
    credits: "Music by The Fourteenth Floor · Horns arranged by M. Adeyemi",
    lrc: `[ti:Brass City Run]
[ar:The Fourteenth Floor]

[00:03.50]Hit the corner running
[00:07.80]Brass and neon in my ears
[00:12.10]Nobody sleeps in this town
[00:16.40]Nobody has in years
[00:20.70]♪
[00:29.00]Run, brass city, run
[00:33.30]Hold that note till it's done`,
  },
  {
    slug: "quiet-hours",
    title: "Quiet Hours",
    artist: "Anders Holm",
    album: "Nightshift",
    genre: "Jazz",
    mood: "Focus",
    releaseYear: 2011,
    durationSec: 305,
    bpm: 92,
    musicalKey: "B flat",
    notes:
      "Recorded live in a hotel bar after closing, with the room mics left open — the clink you can hear at 2:40 is a glass being put away.",
    credits: "Composed by A. Holm · Piano, A. Holm · Bass, K. Lindqvist",
    // No LRC on purpose: this is the "sync not available yet" path from §3.4.
    plainText: `Chairs up on the tables
The last of the ice going soft
Nobody left to play for
So I play for the room instead

Quiet hours
The best hours`,
  },
  {
    slug: "harvest-line",
    title: "Harvest Line",
    artist: "Bell & Crow",
    album: "Field Recordings",
    genre: "Country",
    mood: "Happy",
    releaseYear: 1969,
    durationSec: 176,
    bpm: 104,
    musicalKey: "G major",
    notes:
      "The oldest track in this catalog, and the reason the “Old classics” shelf exists. Two takes, one microphone, no overdubs.",
    credits: "Traditional, arranged by Bell & Crow",
    lrc: `[ti:Harvest Line]
[ar:Bell & Crow]

[00:02.80]Down along the harvest line
[00:07.10]Everybody's back is bent
[00:11.40]Sun don't ask you how you feel
[00:15.70]It just asks you where you went`,
  },
  {
    slug: "glass-elevator",
    title: "Glass Elevator",
    artist: "Neon Harbour",
    album: "Long Wave",
    genre: "Electronic",
    mood: "Party",
    releaseYear: 2024,
    durationSec: 228,
    bpm: 128,
    musicalKey: "C minor",
    notes:
      "The B-side that outgrew the A-side. Its 128 BPM and long intro make it the easiest track here to beatmatch — a good first try in the DJ booth.",
    credits: "Words and music by Neon Harbour",
    lrc: `[ti:Glass Elevator]
[ar:Neon Harbour]

[00:08.00]Forty floors of nothing
[00:13.50]Just the city getting small
[00:19.00]Everybody's watching
[00:24.50]Nobody's here at all
[00:30.00]♪
[00:35.50]Going up, going up
[00:41.00]Never coming down`,
  },
];

function decadeOf(year: number) {
  return Math.floor(year / 10) * 10;
}

async function seedSongs() {
  let added = 0;
  let skipped = 0;

  for (const entry of SEED_SONGS) {
    const id = seedId(entry.slug);

    const [existing] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(songs).values({
      id,
      title: entry.title,
      artist: entry.artist,
      album: entry.album,
      genre: entry.genre,
      mood: entry.mood,
      releaseYear: entry.releaseYear,
      decade: decadeOf(entry.releaseYear),
      durationSec: entry.durationSec,
      coverUrl: null,
      audioUrl: PUBLIC_DOMAIN_AUDIO,
      previewUrl: null,
      source: "local",
      bpm: entry.bpm,
      musicalKey: entry.musicalKey,
      notes: entry.notes,
      credits: entry.credits,
      licenseNote: "Sample metadata for local development · audio: public domain",
      isPublished: true,
    });

    if (entry.lrc) {
      const parsed = parseLrc(entry.lrc);
      await db.insert(lyrics).values({
        id: seedId(`lyr-${entry.slug}`),
        songId: id,
        plainText: parsed.plainText,
        synced: { lines: parsed.lines },
        format: "lrc",
      });
    } else if (entry.plainText) {
      await db.insert(lyrics).values({
        id: seedId(`lyr-${entry.slug}`),
        songId: id,
        plainText: entry.plainText,
        synced: null,
        format: "none",
      });
    }

    added++;
  }

  return { added, skipped };
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!email) {
    return { created: false, reason: "ADMIN_EMAIL is not set — skipping admin account." };
  }

  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    // Promote an account that signed up before ADMIN_EMAIL was configured.
    if (existing.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
      return { created: false, reason: `Promoted the existing ${email} to admin.` };
    }
    return { created: false, reason: `${email} is already an admin.` };
  }

  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    return {
      created: false,
      reason:
        `No account exists for ${email} yet. Either sign up with that address ` +
        "(it's granted admin automatically), or set SEED_ADMIN_PASSWORD and re-run.",
    };
  }

  await db.insert(users).values({
    id: seedId("admin"),
    email,
    displayName: "SingPlay Admin",
    passwordHash: await hash(password, 12),
    role: "admin",
    emailVerifiedAt: new Date(),
  });

  return { created: true, reason: `Created an admin account for ${email}.` };
}

async function main() {
  console.info("Seeding SingPlay…\n");

  const catalog = await seedSongs();
  console.info(
    `  Songs:  ${catalog.added} added, ${catalog.skipped} already present (${SEED_SONGS.length} total)`,
  );

  const admin = await seedAdmin();
  console.info(`  Admin:  ${admin.reason}`);

  console.info(
    "\nDone. Start the app with `npm run dev`." +
      "\nNote: the seeded tracks share one short public-domain audio file, so they" +
      "\nall sound the same — the metadata, lyrics and timing are the real payload.",
  );
}

main().catch((error) => {
  console.error("\nSeeding failed:", error);
  process.exit(1);
});
