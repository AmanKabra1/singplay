import Link from "next/link";
import { Disc3, Mic2, Sparkles } from "lucide-react";

import { Shelf } from "@/components/song/SongCard";
import { EmptyState } from "@/components/ui/States";
import { GENRES, LANGUAGE_HUES, LANGUAGES, MOODS } from "@/lib/constants";
import { recentlyPlayed } from "@/lib/server/library";
import { browseSections } from "@/lib/server/songs";
import { currentViewer } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Genre / mood color map — each value is an HSL hue used for both the chip
// style and the shelf accent dot.
// ---------------------------------------------------------------------------

const GENRE_HUES: Record<string, number> = {
  Pop: 290,
  Rock: 15,
  "Hip Hop": 35,
  Electronic: 195,
  Jazz: 45,
  Classical: 48,
  Folk: 140,
  Metal: 0,
  Soul: 340,
  Reggae: 130,
  Country: 85,
  Lounge: 260,
  World: 180,
  Soundtrack: 220,
};

const MOOD_HUES: Record<string, number> = {
  Happy: 48,
  Chill: 210,
  Energetic: 10,
  Romantic: 345,
  Melancholic: 240,
  Focus: 200,
  Party: 285,
  Workout: 25,
};

/** Maps a shelf key to the search URL that reproduces it. */
function browseHref(key: string): string {
  if (key.startsWith("genre-")) {
    const slug = key.slice("genre-".length).replace(/-/g, " ");
    const genre = slug.charAt(0).toUpperCase() + slug.slice(1);
    return `/search?genre=${encodeURIComponent(genre)}`;
  }
  if (key.startsWith("lang-")) {
    const slug = key.slice("lang-".length).replace(/-/g, " ");
    const lang = slug.charAt(0).toUpperCase() + slug.slice(1);
    return `/search?language=${encodeURIComponent(lang)}`;
  }
  switch (key) {
    case "popular": return "/search?sort=popular";
    case "classics": return "/search?decade=0";
    case "new":      return "/search?sort=new";
    default:         return "/search";
  }
}

/** Returns the HSL hue for a shelf's accent dot. */
function shelfHue(key: string): number | undefined {
  if (key.startsWith("genre-")) {
    const genre = key.slice("genre-".length).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return GENRE_HUES[genre];
  }
  if (key.startsWith("lang-")) {
    const lang = key.slice("lang-".length).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return LANGUAGE_HUES[lang];
  }
  switch (key) {
    case "new":     return 195;
    case "popular": return 35;
    case "classics": return 48;
    default:        return undefined;
  }
}

export default async function HomePage() {
  const { user, viewer } = await currentViewer();

  const [sections, recent] = await Promise.all([
    browseSections(viewer),
    user ? recentlyPlayed({ id: user.id, isAuthenticated: true }, 12) : [],
  ]);

  const empty = sections.length === 0 && recent.length === 0;

  return (
    <div className="flex flex-col gap-10">
      {!user && <GuestHero />}

      {empty ? (
        <EmptyState
          icon={<Disc3 className="size-9" />}
          title="The catalog is empty"
          description="No tracks have been published yet. An admin can add them from the admin area, or import a batch from the Creative Commons catalog."
          action={
            <Link
              href="/admin/songs"
              className="tap inline-flex items-center rounded-xl bg-accent px-5 text-fluid-sm font-semibold text-white"
            >
              Go to song management
            </Link>
          }
        />
      ) : (
        <>
          {recent.length > 0 && (
            <Shelf title="Jump back in" subtitle="Where you left off" songs={recent} />
          )}

          {sections.map((section) => (
            <Shelf
              key={section.key}
              title={section.title}
              subtitle={section.subtitle}
              songs={section.songs}
              accent={shelfHue(section.key)}
              action={
                <Link
                  href={browseHref(section.key)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-text"
                >
                  See all
                </Link>
              }
            />
          ))}

          <BrowseByChips />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero — shown to guests only
// ---------------------------------------------------------------------------

function GuestHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-linear-to-br from-accent-dim/60 via-surface-2/80 to-surface p-7 sm:p-11">
      {/* Glow blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 bottom-0 size-72 rounded-full bg-cyan/10 blur-3xl"
      />

      {/* Large decorative music symbol */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-8 top-4 hidden select-none text-[9rem] font-bold leading-none text-white/[0.035] sm:block"
      >
        ♪
      </div>

      <div className="relative max-w-xl">
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent-soft ring-1 ring-inset ring-accent/25">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Free &amp; legal to stream
        </p>

        {/* Gradient headline */}
        <h1
          className="text-fluid-2xl font-extrabold leading-tight"
          style={{
            background: "linear-gradient(135deg, var(--color-text) 0%, var(--color-accent-soft) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Listen, then sing it yourself.
        </h1>

        <p className="mt-3.5 text-fluid-base leading-relaxed text-muted">
          Every track comes with lyrics. Flip on karaoke mode and they scroll
          in time with the music — practise line by line, then take both decks
          for a spin in the DJ booth.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/signup"
            className="tap inline-flex items-center rounded-xl bg-accent px-5 text-fluid-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-soft hover:shadow-accent/30"
          >
            Create a free account
          </Link>
          <Link
            href="/search"
            className="tap inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface-2 px-5 text-fluid-sm font-medium transition-colors hover:bg-surface-3"
          >
            <Mic2 className="size-4" aria-hidden="true" />
            Browse the catalog
          </Link>
        </div>

        <p className="mt-4 text-xs text-faint">Guests hear a 30-second preview per track.</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Colorful browse chips
// ---------------------------------------------------------------------------

function BrowseByChips() {
  return (
    <section className="flex flex-col gap-6">
      <ColoredChipRow title="Browse by language" param="language" values={LANGUAGES} hues={LANGUAGE_HUES} />
      <ColoredChipRow title="Browse by genre" param="genre" values={GENRES} hues={GENRE_HUES} />
      <ColoredChipRow title="Browse by mood" param="mood" values={MOODS} hues={MOOD_HUES} />
    </section>
  );
}

function ColoredChipRow({
  title,
  param,
  values,
  hues,
}: {
  title: string;
  param: string;
  values: readonly string[];
  hues: Record<string, number>;
}) {
  return (
    <div>
      <h2 className="mb-3 text-fluid-lg font-bold">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {values.map((value) => {
          const hue = hues[value] ?? 260;
          return (
            <li key={value}>
              <Link
                href={`/search?${param}=${encodeURIComponent(value)}`}
                className="tap inline-flex items-center rounded-full px-4 text-fluid-sm font-medium transition-all hover:scale-[1.03] active:scale-95"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue} 60% 22% / 0.55), hsl(${hue} 50% 16% / 0.35))`,
                  border: `1px solid hsl(${hue} 55% 45% / 0.3)`,
                  color: `hsl(${hue} 80% 72%)`,
                }}
              >
                {value}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
