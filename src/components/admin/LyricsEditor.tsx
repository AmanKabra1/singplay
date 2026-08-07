"use client";

import { AlertTriangle, Clock, FileText, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, FormSuccess, TextArea } from "@/components/ui/Field";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { parseLrc, toLrc } from "@/lib/lrc";
import type { LyricsDTO } from "@/lib/types";
import { clearFetchCache } from "@/lib/hooks/useFetch";
import { cn, formatDuration } from "@/lib/utils";
import { toast } from "@/store/ui";

const LRC_EXAMPLE = `[ti:Song title]
[ar:Artist]

[00:12.40]First line of the chorus
[00:16.85]Second line, right on the beat
[00:21.10]♪`;

/**
 * Lyrics editor (brief §3.7).
 *
 * LRC is parsed in the browser purely for the live preview and warnings — the
 * server re-parses on save, and its result is what's stored. Two independent
 * parses of the same input is fine; a preview that disagrees with what got
 * saved would not be.
 */
export function LyricsEditor({
  songId,
  initial,
  durationSec,
}: {
  songId: string;
  initial: LyricsDTO;
  durationSec: number;
}) {
  const [lrc, setLrc] = useState(() =>
    initial.synced ? toLrc(initial.synced) : "",
  );
  const [plainText, setPlainText] = useState(initial.plainText ?? "");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);

  const parsed = lrc.trim() ? parseLrc(lrc) : null;
  const timedLines = parsed?.lines ?? [];

  // Timestamps past the end of the track are the most common LRC mistake, and
  // they're invisible until someone tries to sing along.
  const overruns =
    durationSec > 0 ? timedLines.filter((line) => line.t > durationSec + 1) : [];
  const outOfOrder = timedLines.some(
    (line, index) => index > 0 && line.t < timedLines[index - 1]!.t,
  );

  async function save() {
    setBusy(true);
    setFormError(null);
    setSuccess(null);
    setServerWarnings([]);

    try {
      const result = await apiFetch<{
        format: string;
        lineCount: number;
        warnings: string[];
      }>(`/api/admin/songs/${songId}/lyrics`, {
        method: "PUT",
        body: {
          lrc: lrc.trim() || undefined,
          plainText: plainText.trim() || undefined,
        },
      });

      setServerWarnings(result.warnings);
      setSuccess(
        result.format === "lrc"
          ? `Saved ${result.lineCount} timed line${result.lineCount === 1 ? "" : "s"} — sing-along mode is live for this track.`
          : "Saved as plain lyrics. Add timestamps to unlock sing-along mode.",
      );
      clearFetchCache(`/api/songs/${songId}`);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch(`/api/admin/songs/${songId}/lyrics`, { method: "DELETE" });
      setLrc("");
      setPlainText("");
      setSuccess(null);
      setServerWarnings([]);
      clearFetchCache(`/api/songs/${songId}`);
      toast.success("Lyrics removed");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  /** Strips timestamps out of the LRC to seed the plain-text sheet. */
  function derivePlainText() {
    if (!parsed) return;
    setPlainText(parsed.plainText);
    toast.info("Plain lyrics filled in", "Timestamps stripped from the LRC above.");
  }

  return (
    <div className="flex flex-col gap-5">
      <FormError message={formError} />
      <FormSuccess message={success} />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field
            label="Timed lyrics (LRC)"
            hint="One line per lyric, each prefixed with [mm:ss.xx]. Enhanced LRC word timings (<mm:ss.xx>) are supported too."
          >
            {(props) => (
              <TextArea
                {...props}
                value={lrc}
                onChange={(event) => setLrc(event.target.value)}
                rows={16}
                spellCheck={false}
                placeholder={LRC_EXAMPLE}
                className="font-mono text-xs leading-relaxed"
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={derivePlainText} disabled={!parsed}>
              <Wand2 className="size-4" aria-hidden="true" />
              Fill plain lyrics from LRC
            </Button>
          </div>

          <Field
            label="Plain lyrics"
            hint="Shown on the song page, and as the fallback when there's no timing data."
          >
            {(props) => (
              <TextArea
                {...props}
                value={plainText}
                onChange={(event) => setPlainText(event.target.value)}
                rows={8}
                className="text-fluid-sm leading-relaxed"
              />
            )}
          </Field>
        </div>

        {/* Preview & diagnostics */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <h3 className="flex items-center gap-2 text-fluid-sm font-semibold">
              <Clock className="size-4 text-accent-soft" aria-hidden="true" />
              Timing summary
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-fluid-sm">
              <div>
                <dt className="text-xs uppercase tracking-widest text-faint">
                  Timed lines
                </dt>
                <dd className="font-mono tabular-nums">{timedLines.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-faint">
                  Word timings
                </dt>
                <dd className="font-mono tabular-nums">
                  {timedLines.filter((line) => line.words?.length).length}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-faint">
                  First line at
                </dt>
                <dd className="font-mono tabular-nums">
                  {timedLines.length > 0 ? formatDuration(timedLines[0]!.t) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-faint">
                  Last line at
                </dt>
                <dd className="font-mono tabular-nums">
                  {timedLines.length > 0
                    ? formatDuration(timedLines[timedLines.length - 1]!.t)
                    : "—"}
                </dd>
              </div>
            </dl>

            {durationSec > 0 && (
              <p className="mt-3 text-xs text-faint">
                Track length: {formatDuration(durationSec)}
              </p>
            )}
          </div>

          {(parsed?.warnings.length ||
            serverWarnings.length ||
            overruns.length > 0 ||
            outOfOrder) && (
            <div
              role="alert"
              className="rounded-xl border border-warning/30 bg-warning/10 p-4"
            >
              <h3 className="flex items-center gap-2 text-fluid-sm font-semibold text-warning">
                <AlertTriangle className="size-4" aria-hidden="true" />
                Worth a look
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
                {outOfOrder && (
                  <li>
                    Some timestamps run backwards. They&apos;ll be sorted on save,
                    but check they say what you meant.
                  </li>
                )}
                {overruns.length > 0 && (
                  <li>
                    {overruns.length} line{overruns.length === 1 ? "" : "s"} time
                    past the end of the track (
                    {formatDuration(durationSec)}) — those will never highlight.
                  </li>
                )}
                {[...(parsed?.warnings ?? []), ...serverWarnings].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex min-h-56 flex-col rounded-xl border border-border bg-surface-2">
            <h3 className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-fluid-sm font-semibold">
              <FileText className="size-4 text-accent-soft" aria-hidden="true" />
              Preview
            </h3>
            {timedLines.length > 0 ? (
              <ol className="max-h-72 overflow-y-auto px-4 py-3">
                {timedLines.map((line, index) => (
                  <li
                    key={`${line.t}-${index}`}
                    className="flex gap-3 py-0.5 text-fluid-sm"
                  >
                    <span
                      className={cn(
                        "shrink-0 font-mono text-xs tabular-nums",
                        durationSec > 0 && line.t > durationSec + 1
                          ? "text-warning"
                          : "text-faint",
                      )}
                    >
                      {formatDuration(line.t)}
                    </span>
                    <span className="min-w-0 flex-1 text-muted">
                      {line.text || "♪"}
                      {line.words?.length ? (
                        <span className="ml-1.5 text-[0.65rem] text-accent-soft">
                          {line.words.length} words
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="grid flex-1 place-items-center px-4 py-6 text-center text-fluid-sm text-faint">
                Paste LRC above and the parsed timing appears here.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          loading={busy}
          disabled={!lrc.trim() && !plainText.trim()}
          onClick={save}
        >
          Save lyrics
        </Button>
        {(initial.plainText || initial.synced) && (
          <Button variant="danger" size="lg" disabled={busy} onClick={clearAll}>
            <Trash2 className="size-4" aria-hidden="true" />
            Remove all lyrics
          </Button>
        )}
      </div>
    </div>
  );
}
