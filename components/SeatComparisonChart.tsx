"use client";

import dynamic from "next/dynamic";
import type { PublicParty } from "@/lib/config";
import type { SeatMap } from "@/lib/seats";
import { formatSeats } from "@/lib/ui";
import type { SeatRow } from "./SeatBarChart";

// Recharts is only needed here; load it after the page renders.
const SeatBarChart = dynamic(() => import("./SeatBarChart"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-slate-100" />,
});

type Props = { parties: PublicParty[]; mine: SeatMap | null; average: Record<string, number> };

export function SeatComparisonChart({ parties, mine, average }: Props) {
  const rows: SeatRow[] = parties
    .filter((p) => !p.withdrawn || (average[p.id] ?? 0) > 0)
    .map((p) => ({ name: p.name, color: p.color, mine: mine ? (mine[p.id] ?? 0) : null, average: average[p.id] ?? 0 }));

  return (
    <figure>
      <div aria-hidden>
        <SeatBarChart rows={rows} showMine={mine !== null} />
      </div>
      <figcaption className="sr-only">מנדטים לכל רשימה: ההצבעה שלי מול ממוצע כולם</figcaption>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">טבלת המנדטים</caption>
        <thead>
          <tr className="text-slate-600">
            <th scope="col" className="py-1 text-start font-semibold">
              רשימה
            </th>
            {mine && (
              <th scope="col" className="py-1 text-center font-semibold">
                ההצבעה שלי
              </th>
            )}
            <th scope="col" className="py-1 text-center font-semibold">
              ממוצע כולם
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row" className="py-1.5 text-start font-normal">
                <span className="me-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: row.color }} aria-hidden />
                {row.name}
              </th>
              {mine && <td className="text-center font-bold tabular-nums">{row.mine}</td>}
              <td className="text-center tabular-nums">{formatSeats(row.average)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
