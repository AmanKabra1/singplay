"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { UploadField } from "@/components/admin/UploadField";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/ui/Field";
import { apiFetch, errorMessage, RequestError } from "@/lib/api/client";
import { GENRES, MOODS } from "@/lib/constants";
import { clearFetchCache } from "@/lib/hooks/useFetch";
import { toast } from "@/store/ui";

export type SongFormValues = {
  title: string;
  artist: string;
  album: string;
  genre: string;
  mood: string;
  releaseYear: string;
  durationSec: string;
  bpm: string;
  musicalKey: string;
  coverUrl: string;
  audioUrl: string;
  previewUrl: string;
  notes: string;
  credits: string;
  licenseNote: string;
  isPublished: boolean;
};

export const emptySong: SongFormValues = {
  title: "",
  artist: "",
  album: "",
  genre: "",
  mood: "",
  releaseYear: "",
  durationSec: "",
  bpm: "",
  musicalKey: "",
  coverUrl: "",
  audioUrl: "",
  previewUrl: "",
  notes: "",
  credits: "",
  licenseNote: "",
  isPublished: true,
};

/** Add / edit a track (brief §3.7). */
export function SongForm({
  songId,
  initial,
}: {
  songId?: string;
  initial: SongFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof SongFormValues>(key: K, value: SongFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  /** Blank optional numbers must go over the wire as null, not as NaN or "". */
  function numberOrNull(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const local: Record<string, string> = {};
    if (!values.title.trim()) local.title = "A title is required.";
    if (!values.artist.trim()) local.artist = "An artist is required.";
    if (!values.audioUrl.trim()) {
      local.audioUrl = "Upload an audio file, or paste a URL to one.";
    }
    if (Object.keys(local).length > 0) {
      setFieldErrors(local);
      setFormError("Please check the highlighted fields.");
      return;
    }

    const payload = {
      title: values.title.trim(),
      artist: values.artist.trim(),
      album: values.album.trim(),
      genre: values.genre.trim(),
      mood: values.mood.trim(),
      releaseYear: numberOrNull(values.releaseYear),
      durationSec: numberOrNull(values.durationSec) ?? 0,
      bpm: numberOrNull(values.bpm),
      musicalKey: values.musicalKey.trim(),
      coverUrl: values.coverUrl.trim(),
      audioUrl: values.audioUrl.trim(),
      previewUrl: values.previewUrl.trim(),
      notes: values.notes.trim(),
      credits: values.credits.trim(),
      licenseNote: values.licenseNote.trim(),
      isPublished: values.isPublished,
    };

    setBusy(true);
    try {
      if (songId) {
        await apiFetch(`/api/admin/songs/${songId}`, { method: "PATCH", body: payload });
        toast.success("Track updated", payload.title);
      } else {
        const result = await apiFetch<{ id: string }>("/api/admin/songs", {
          method: "POST",
          body: payload,
        });
        toast.success("Track added", "Next: add lyrics to unlock sing-along mode.");
        clearFetchCache("/api/admin/songs");
        clearFetchCache("/api/songs");
        router.push(`/admin/songs/${result.id}`);
        return;
      }
      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      router.refresh();
    } catch (error) {
      if (error instanceof RequestError) setFieldErrors(error.fieldErrors);
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />

      <Section title="The essentials">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required error={fieldErrors.title}>
            {(props) => (
              <TextInput
                {...props}
                value={values.title}
                onChange={(event) => set("title", event.target.value)}
                maxLength={255}
              />
            )}
          </Field>
          <Field label="Artist" required error={fieldErrors.artist}>
            {(props) => (
              <TextInput
                {...props}
                value={values.artist}
                onChange={(event) => set("artist", event.target.value)}
                maxLength={255}
              />
            )}
          </Field>
          <Field label="Album" error={fieldErrors.album}>
            {(props) => (
              <TextInput
                {...props}
                value={values.album}
                onChange={(event) => set("album", event.target.value)}
                maxLength={255}
              />
            )}
          </Field>
          <Field
            label="Release year"
            hint="Drives “Old classics” browsing."
            error={fieldErrors.releaseYear}
          >
            {(props) => (
              <TextInput
                {...props}
                type="number"
                inputMode="numeric"
                min={1900}
                max={new Date().getFullYear() + 1}
                value={values.releaseYear}
                onChange={(event) => set("releaseYear", event.target.value)}
              />
            )}
          </Field>
          <Field label="Genre" error={fieldErrors.genre}>
            {(props) => (
              <Select
                {...props}
                value={values.genre}
                onChange={(event) => set("genre", event.target.value)}
              >
                <option value="">Not set</option>
                {GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Mood" error={fieldErrors.mood}>
            {(props) => (
              <Select
                {...props}
                value={values.mood}
                onChange={(event) => set("mood", event.target.value)}
              >
                <option value="">Not set</option>
                {MOODS.map((mood) => (
                  <option key={mood} value={mood}>
                    {mood}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Audio & artwork">
        <div className="flex flex-col gap-4">
          <UploadField
            kind="audio"
            label="Audio file"
            value={values.audioUrl}
            error={fieldErrors.audioUrl}
            hint="MP3, WAV, OGG, FLAC or M4A. Uploads go straight to object storage."
            onChange={(url) => set("audioUrl", url)}
          />
          <UploadField
            kind="cover"
            label="Cover art"
            value={values.coverUrl}
            error={fieldErrors.coverUrl}
            hint="Square images look best."
            onChange={(url) => set("coverUrl", url)}
          />
          <Field
            label="Preview clip URL"
            hint="Optional. Guests hear this instead of the full track; leave blank and the full file is capped at 30 seconds for them."
            error={fieldErrors.previewUrl}
          >
            {(props) => (
              <TextInput
                {...props}
                value={values.previewUrl}
                onChange={(event) => set("previewUrl", event.target.value)}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section
        title="For the DJ booth"
        description="Optional, but a BPM here saves the decks from having to detect it."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Duration (seconds)" error={fieldErrors.durationSec}>
            {(props) => (
              <TextInput
                {...props}
                type="number"
                inputMode="numeric"
                min={0}
                value={values.durationSec}
                onChange={(event) => set("durationSec", event.target.value)}
              />
            )}
          </Field>
          <Field label="BPM" error={fieldErrors.bpm}>
            {(props) => (
              <TextInput
                {...props}
                type="number"
                inputMode="numeric"
                min={20}
                max={300}
                value={values.bpm}
                onChange={(event) => set("bpm", event.target.value)}
              />
            )}
          </Field>
          <Field label="Musical key" error={fieldErrors.musicalKey}>
            {(props) => (
              <TextInput
                {...props}
                value={values.musicalKey}
                onChange={(event) => set("musicalKey", event.target.value)}
                placeholder="A minor"
                maxLength={16}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section
        title="Notes & credits"
        description="Shown on the song page. Notes are the trivia or background; credits are the writers and performers."
      >
        <div className="flex flex-col gap-4">
          <Field label="Song notes" error={fieldErrors.notes}>
            {(props) => (
              <TextArea
                {...props}
                value={values.notes}
                onChange={(event) => set("notes", event.target.value)}
                rows={5}
                placeholder="Recorded in a single take in a converted barn…"
              />
            )}
          </Field>
          <Field label="Credits" error={fieldErrors.credits}>
            {(props) => (
              <TextArea
                {...props}
                value={values.credits}
                onChange={(event) => set("credits", event.target.value)}
                rows={3}
                placeholder="Written by … · Produced by …"
              />
            )}
          </Field>
          <Field
            label="Licence note"
            hint="Displayed on the song page for attribution. Required by most Creative Commons licences."
            error={fieldErrors.licenseNote}
          >
            {(props) => (
              <TextInput
                {...props}
                value={values.licenseNote}
                onChange={(event) => set("licenseNote", event.target.value)}
                placeholder="CC BY-SA 3.0 — Artist Name"
                maxLength={255}
              />
            )}
          </Field>
        </div>
      </Section>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2 p-4">
        <input
          type="checkbox"
          checked={values.isPublished}
          onChange={(event) => set("isPublished", event.target.checked)}
          className="mt-0.5 size-4 accent-accent"
        />
        <span className="text-fluid-sm">
          Published
          <span className="block text-xs text-muted">
            Unpublished tracks stay as drafts — visible here, invisible to
            listeners and excluded from search.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" loading={busy}>
          {songId ? "Save changes" : "Add track"}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => router.push("/admin/songs")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-fluid-lg font-bold">{title}</h2>
      {description && (
        <p className="mt-1 text-fluid-sm leading-relaxed text-muted">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
