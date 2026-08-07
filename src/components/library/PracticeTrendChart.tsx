"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; label: string; minutes: number };

/**
 * Seven days of sing-along minutes.
 *
 * One series, so there's no legend — the heading names it — and no colour is
 * carrying identity. Days with no practice keep a faint stub so the week reads
 * as seven slots rather than a ragged three.
 */
export function PracticeTrendChart({ data }: { data: Point[] }) {
  const total = data.reduce((sum, point) => sum + point.minutes, 0);
  const busiest = Math.max(...data.map((point) => point.minutes), 0);

  return (
    <figure className="rounded-xl border border-border bg-surface p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-fluid-sm text-muted">
          {total > 0
            ? `${total} minute${total === 1 ? "" : "s"} of practice over the last 7 days`
            : "No practice logged in the last 7 days"}
        </span>
        <span className="text-xs text-faint">minutes per day</span>
      </figcaption>

      <div className="h-40 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
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
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
                    <p className="font-semibold text-text">{label}</p>
                    <p className="text-muted">
                      {payload[0]!.value as number} min of practice
                    </p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={34}>
              {data.map((point) => (
                <Cell
                  key={point.date}
                  fill={
                    point.minutes === busiest && busiest > 0
                      ? "var(--color-accent-soft)"
                      : "var(--color-accent)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* The same numbers, reachable without seeing the chart. */}
      <table className="sr-only">
        <caption>Practice minutes per day over the last seven days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{point.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
