"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/ui/States";
import type { AdminOverview } from "@/lib/server/analytics";
import { LISTENING_MODES, MODE_COLORS, MODE_LABELS } from "./palette";

/**
 * Admin analytics (brief §3.7).
 *
 * Three shapes, chosen by what each measure is for: a KPI row for the headline
 * counts, a single-series line for plays over time, and ranked bar rows for the
 * top-N lists. No pie chart, and no second y-axis — plays and searches are
 * different measures, so they get their own panels.
 */
export function AdminOverviewScreen({ data }: { data: AdminOverview }) {
  const { totals } = data;
  const hasPlays = data.playsPerDay.some((point) => point.plays > 0);

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-fluid-xl font-bold">Overview</h1>
        <p className="text-fluid-sm text-muted">
          Catalog health and listener activity. Counts cover the last 7 days;
          charts and top lists cover 14.
        </p>
      </header>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Songs" value={totals.songs} sub={`${totals.publishedSongs} published`} />
        <Kpi
          label="Drafts"
          value={totals.songs - totals.publishedSongs}
          sub="not visible to listeners"
        />
        <Kpi label="Users" value={totals.users} sub="all time" />
        <Kpi label="Active users" value={totals.activeUsers7d} sub="last 7 days" />
        <Kpi label="Plays" value={totals.plays7d} sub="last 7 days" />
        <Kpi label="DJ sessions" value={totals.djSessions7d} sub="last 7 days" />
      </section>

      <section aria-labelledby="plays-heading">
        <h2 id="plays-heading" className="mb-3 text-fluid-lg font-bold">
          Plays over time
        </h2>

        {hasPlays ? (
          <figure className="rounded-xl border border-border bg-surface p-4">
            <figcaption className="mb-3 text-fluid-sm text-muted">
              Tracks played per day, last 14 days
            </figcaption>

            <div className="h-56 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.playsPerDay}
                  margin={{ top: 6, right: 10, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tick={{ fill: "var(--color-faint)", fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--color-faint)", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
                          <p className="font-semibold text-text">{label}</p>
                          <p className="text-muted">
                            {payload[0]!.value as number} play
                            {payload[0]!.value === 1 ? "" : "s"}
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="plays"
                    stroke="var(--color-accent-soft)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--color-accent-soft)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <table className="sr-only">
              <caption>Plays per day over the last fourteen days</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Plays</th>
                </tr>
              </thead>
              <tbody>
                {data.playsPerDay.map((point) => (
                  <tr key={point.date}>
                    <th scope="row">{point.date}</th>
                    <td>{point.plays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        ) : (
          <EmptyState
            title="No plays recorded yet"
            description="Once listeners start playing tracks, daily activity shows up here."
          />
        )}
      </section>

      <div className="grid gap-7 xl:grid-cols-2">
        <section aria-labelledby="top-songs-heading">
          <h2 id="top-songs-heading" className="mb-3 text-fluid-lg font-bold">
            Most played
          </h2>
          {data.topSongs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-fluid-sm text-faint">
              Nothing played in the last 14 days.
            </p>
          ) : (
            <ol className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              {data.topSongs.map((song, index) => (
                <li key={song.id}>
                  <RankedRow
                    label={
                      <Link href={`/song/${song.id}`} className="hover:underline">
                        {song.title}
                        <span className="text-muted"> — {song.artist}</span>
                      </Link>
                    }
                    value={song.plays}
                    max={data.topSongs[0]!.plays}
                    rank={index + 1}
                    unit="plays"
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="top-searches-heading">
          <h2 id="top-searches-heading" className="mb-3 text-fluid-lg font-bold">
            Most searched
          </h2>
          {data.topSearches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-fluid-sm text-faint">
              No searches logged in the last 14 days.
            </p>
          ) : (
            <ol className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              {data.topSearches.map((search, index) => (
                <li key={search.query}>
                  <RankedRow
                    label={
                      <Link
                        href={`/search?q=${encodeURIComponent(search.query)}`}
                        className="hover:underline"
                      >
                        “{search.query}”
                      </Link>
                    }
                    value={search.count}
                    max={data.topSearches[0]!.count}
                    rank={index + 1}
                    unit="searches"
                    // A popular query returning nothing is the single most
                    // actionable signal on this page — it names what to add next.
                    note={
                      search.avgResults === 0
                        ? "no results — consider adding this"
                        : `~${search.avgResults} results`
                    }
                    warn={search.avgResults === 0}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {data.modeSplit.length > 0 && (
        <section aria-labelledby="modes-heading">
          <h2 id="modes-heading" className="mb-3 text-fluid-lg font-bold">
            How people listen
          </h2>
          <dl className="grid grid-cols-3 gap-3">
            {LISTENING_MODES.map((mode) => {
              const plays =
                data.modeSplit.find((entry) => entry.mode === mode)?.plays ?? 0;
              const total = data.modeSplit.reduce((sum, entry) => sum + entry.plays, 0);
              const share = total > 0 ? Math.round((plays / total) * 100) : 0;

              return (
                <div
                  key={mode}
                  className="rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <dt className="flex items-center gap-2 text-xs uppercase tracking-widest text-faint">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{ background: MODE_COLORS[mode] }}
                    />
                    {MODE_LABELS[mode]}
                  </dt>
                  <dd className="mt-1.5 text-fluid-lg font-bold tabular-nums">
                    {share}%
                    <span className="ml-1.5 text-fluid-sm font-normal text-muted">
                      {plays} play{plays === 1 ? "" : "s"}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-1 text-fluid-xl font-bold tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}

/** A ranked list row: label, proportional bar, value. The value is always shown. */
function RankedRow({
  label,
  value,
  max,
  rank,
  unit,
  note,
  warn,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  rank: number;
  unit: string;
  note?: string;
  warn?: boolean;
}) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-faint">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-fluid-sm">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-1.5 rounded-full bg-accent"
            style={{ width: `${width}%` }}
          />
          {note && (
            <span className={warn ? "text-xs text-warning" : "text-xs text-faint"}>
              {note}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 font-mono text-fluid-sm tabular-nums">
        {value.toLocaleString()}
        <span className="ml-1 text-xs text-faint">{unit}</span>
      </span>
    </div>
  );
}
