# SingPlay

A music player, karaoke trainer and DJ booth in one responsive web app. Browse a
catalog, play tracks through a persistent player, practise singing with lyrics
that highlight in time with the music, and mix two decks in a personal DJ booth.

Built on Next.js 16 (App Router), React 19, Tailwind CSS v4, Drizzle ORM and
TiDB Cloud Serverless.

---

## A note on music licensing

Commercial chart music **cannot legally be streamed without licensing deals** with
the labels and performing-rights organisations that own it. SingPlay is therefore
built against sources that are legal to stream:

- **Creative Commons catalog** — the built-in [Jamendo](https://devportal.jamendo.com)
  importer pulls CC-licensed tracks into your library, with each track's licence
  text stored and displayed for attribution.
- **Your own uploads** — admin-uploaded original recordings.

The data model calls everything a "song" and doesn't care where the audio lives, so
a licensed provider (Spotify Web Playback SDK, Apple MusicKit) could be added later.
Playback would then have to stay inside that provider's SDK, and the "record my mix"
feature would need to be disabled for those tracks.

---

## What's built

| Area | Detail |
|---|---|
| **Auth** | Email + password with verification, forgot/reset password, Google OAuth, "remember me", role-based access enforced server-side on every request |
| **Catalog** | Browse by genre / mood / decade / artist, search across title, artist, album and **lyric text**, song detail pages with notes and credits |
| **Player** | Persistent mini-player, full-screen Now Playing with synced lyrics, queue, shuffle, repeat, Media Session (lock-screen controls), keyboard shortcuts |
| **Karaoke** | Line-by-line and word-by-word lyric highlighting from LRC timing, auto-scroll, font-size control, 0.75×/0.9×/1× practice speeds with pitch preserved, optional mic level meter, resume-where-you-stopped |
| **DJ booth** | Two decks, per-deck tempo (±16%) with keylock, volume, low/high-pass filter sweep, echo, looping, cue points, real decoded waveforms, BPM detection, equal-power crossfader, master bus and mix recording |
| **Library** | Favourites, playlists (create / rename / reorder / delete / share by link), recently played, practice streaks and stats |
| **Admin** | Song CRUD with direct-to-storage uploads, LRC lyrics editor with live preview and timing diagnostics, Jamendo bulk import, user management, analytics |

Guests can browse and hear a 30-second preview of any track; full playback,
karaoke and the DJ booth require an account.

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Create the environment file

```bash
cp .env.example .env.local
```

Then fill it in. Only two values are strictly required:

| Variable | Required | Where to get it |
|---|---|---|
| `AUTH_SECRET` | **yes** | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DATABASE_URL` | **yes** | TiDB Cloud → your cluster → Connect → **Serverless Driver** |
| `DATABASE_URL_MIGRATE` | for `db:push` | Same cluster, standard MySQL string + `?ssl={"rejectUnauthorized":true}` |
| `ADMIN_EMAIL` | recommended | Any address you control — whoever signs up with it becomes an admin |
| `JAMENDO_CLIENT_ID` | optional | [devportal.jamendo.com](https://devportal.jamendo.com) — enables the catalog importer |
| `GOOGLE_CLIENT_ID` / `SECRET` | optional | Google Cloud Console → OAuth client ID |
| `R2_*` | optional | Cloudflare R2 — without it, uploads fall back to on-disk `./.storage` |
| `RESEND_API_KEY` | optional | Resend — without it, verification and reset links are printed to the server console |

Every optional integration **degrades with an explicit message** rather than
breaking: no Jamendo key hides the importer, no R2 writes to disk, no Resend logs
the email link instead of sending it.

### 3. Create the schema

```bash
npm run db:push
```

### 4. Seed some sample content (optional)

```bash
npm run db:seed
```

This adds six tracks with notes, credits and real LRC timing — including one
track deliberately left un-synced so you can see the "sync not available yet"
fallback. They all share one short public-domain audio file, so they sound
identical; the metadata and lyric timing are the point.

### 5. Run it

```bash
npm run dev
```

Sign up with the address in `ADMIN_EMAIL` to get an admin account, then visit
`/admin` to add real tracks or import from Jamendo.

### Scripts

```bash
npm run dev         # dev server (Turbopack)
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run db:push     # apply the schema to TiDB
npm run db:studio   # browse the database
npm run db:seed     # sample catalog + admin promotion
```

---

## Architecture

```
src/
  app/
    (app)/          # the shell: sidebar, top bar, tab bar, mini-player
    (auth)/         # sign-in, sign-up, password recovery, email confirmation
    api/            # route handlers — every mutation and query the client makes
  components/       # ui/ shell/ player/ karaoke/ dj/ song/ library/ admin/ auth/
  db/               # Drizzle schema, cascades, seed
  lib/
    api/            # ApiError + the single fetch wrapper every client uses
    audio/          # the <audio> engine, and offline waveform/BPM analysis
    auth/           # sessions, password hashing, tokens, guards
    server/         # the data layer: catalog, library, analytics reads
  store/            # zustand: player, DJ decks, transient UI
```

A few decisions worth knowing about:

**No foreign keys.** TiDB is distributed, and FK support has varied across
serverless cluster versions — an unsupported constraint breaks the very first
migration, while a missing one never breaks anyone. Referential integrity is
enforced in [`src/db/cascade.ts`](src/db/cascade.ts) instead, which is the single
file to extend when a new table references a user or a song.

**The player is not routed through Web Audio.** `MediaElementSource` requires the
audio host to send CORS headers, and catalog CDNs often don't. Plain `<audio>`
playback always works. The DJ booth *does* need a Web Audio graph for its filters
and crossfading, so it opts into CORS separately — and a deck whose source blocks
cross-origin reads falls back to basic mode, keeping transport, tempo and
crossfading while disabling the effects rack and saying so on screen.

**Waveforms are real or absent.** Peaks and BPM come from actually decoding the
file. When that isn't possible, the deck shows a working scrub bar and a note,
rather than a decorative waveform that means nothing.

**Guests get preview URLs, not truncated full ones.** The server hands an
unauthenticated request the preview source; the client also caps playback at 30
seconds, but the URL is the boundary that matters.

**Uploads go browser → storage.** A serverless function caps request bodies at
4.5 MB, which most audio files exceed, so the API issues a presigned PUT and the
file never passes through it.

---

## Responsive behaviour

One tree at every size, driven by `clamp()` type, fluid grids and CSS custom
properties — not separate mobile and desktop layouts.

- **< 640px** — single column, bottom tab bar, mini-player docked above it,
  full-screen Now Playing and karaoke stage
- **640–1024px** — two columns where it helps; DJ decks stack in portrait and sit
  side by side in landscape
- **> 1024px** — persistent sidebar, multi-column grids, both decks plus the
  crossfader in one row, lyrics alongside the artwork

Touch targets are ≥ 44px throughout. Hover-only affordances are avoided: Tailwind
v4 already scopes `hover:` to devices that support hover, and the
`reveal-on-hover` utility keeps controls permanently visible on touch.

## Error handling

Built in from the start, not bolted on:

- Network and API failures render a retry state, never a stack trace
- A track that fails to load reports inline and the queue skips on rather than freezing
- Auth errors are specific and inline (`Incorrect email or password`, `That email is already registered`)
- Empty search results get a helpful empty state with a way out
- Forms validate inline before submit, with a live password-strength meter
- Offline is detected, shown as a banner, and surfaced in the fetch layer
- `error.tsx` and `global-error.tsx` catch render crashes with a working recovery path
- Skeletons match the geometry of what replaces them, so nothing reflows on load

## Accessibility

Keyboard-operable transport with global shortcuts, accessible names on every
icon-only control, focus trapping and restoration in dialogs, `aria-live` regions
for status changes, `prefers-reduced-motion` honoured, and a screen-reader table
behind every chart.

## Deploying

Deploys to Vercel as-is. Set every variable from `.env.local` in the project's
environment settings (Production **and** Preview), point
`NEXT_PUBLIC_APP_URL` at the deployed origin, and add
`<origin>/api/auth/google/callback` to the Google OAuth client's authorised
redirect URIs.
