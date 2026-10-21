"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchStats, type PublicStats } from "@/lib/client-api";
import type { PublicConfig } from "@/lib/config";
import { NEW_ELECTIONS_ID } from "@/lib/defaults";
import { formatLockAt } from "@/lib/lock";
import { restoreSeatMap } from "@/lib/seats";
import { useDevice } from "./DeviceProvider";
import { SeatComparisonChart } from "./SeatComparisonChart";
import { Participants } from "./Participants";
import { ShareButton } from "./ShareButton";

export const POLL_INTERVAL_MS = 30_000;

export function Results({ config, initialStats }: { config: PublicConfig; initialStats: PublicStats }) {
  const device = useDevice();
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    const id = window.setInterval(() => {
      fetchStats().then(setStats, () => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const myVote = device.me?.vote ?? null;
  const mine = myVote ? restoreSeatMap(myVote.seats, config.parties) : null;
  const myPm = myVote ? config.pmCandidates.find((c) => c.id === myVote.pmCandidateId) : undefined;
  const locked = stats.locked;

  return (
    <main className="space-y-5 pt-6">
      <header>
        <h1 className="text-2xl font-extrabold text-blue-900">תוצאות</h1>
        <p className="mt-1 text-slate-700">
          {stats.participants === 0 ? "עוד אין הצבעות. היו הראשונים!" : `${stats.participants} משתתפים הצביעו`}
          {locked ? " · ההצבעה נעולה" : config.lockAt ? ` · ההצבעה נסגרת ב-${formatLockAt(config.lockAt)}` : ""}
        </p>
      </header>

      {stats.realResults && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          התוצאות האמיתיות הוזנו. ראש הממשלה בפועל: <strong>{config.pmCandidates.find((c) => c.id === stats.realResults?.pmCandidateId)?.name ?? "?"}</strong>. הדירוג למטה.
        </p>
      )}
      <div className="space-y-2">
        {device.status === "ready" && myVote && !locked && (
          <Link
            href="/vote"
            className="block w-full rounded-xl bg-blue-800 px-4 py-3 text-center text-lg font-bold text-white shadow"
          >
            ערוך את ההצבעה שלי
          </Link>
        )}
        {device.status === "ready" && !myVote && !locked && (
          <Link href="/vote" className="block w-full rounded-xl bg-blue-800 px-4 py-3 text-center text-lg font-bold text-white">
            להצבעה שלי
          </Link>
        )}
        {device.status === "anonymous" && !locked && (
          <Link href="/" className="block w-full rounded-xl bg-blue-800 px-4 py-3 text-center text-lg font-bold text-white">
            להצבעה
          </Link>
        )}
        <ShareButton />
      </div>

      <section aria-labelledby="seats-title" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 id="seats-title" className="text-lg font-bold">
          {mine ? "ההצבעה שלי מול ממוצע כולם" : "ממוצע כולם"}
        </h2>
        <SeatComparisonChart parties={config.parties} mine={mine} average={stats.avgSeats} />
      </section>

      <section aria-labelledby="pm-title" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 id="pm-title" className="text-lg font-bold">
          מי יהיה ראש הממשלה
        </h2>
        {myPm && (
          <p className="mt-1 text-sm text-slate-600">
            הבחירה שלי: <strong>{myPm.name}</strong>
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {config.pmCandidates.map((c) => {
            const share = stats.pmShare[c.id] ?? 0;
            return (
              <li key={c.id}>
                <div className="flex justify-between text-sm">
                  <span className={c.id === NEW_ELECTIONS_ID ? "font-semibold" : undefined}>{c.name}</span>
                  <span className="font-bold tabular-nums">{share}%</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div
                    className={`h-full rounded-full ${c.id === myVote?.pmCandidateId ? "bg-blue-800" : "bg-slate-400"}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Participants config={config} ballots={stats.ballots} realResults={stats.realResults} />
    </main>
  );
}
