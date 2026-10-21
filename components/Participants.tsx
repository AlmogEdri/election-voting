"use client";

import { useState } from "react";
import type { BallotEntry } from "@/lib/client-api";
import type { PublicConfig } from "@/lib/config";
import type { RealResults } from "@/lib/settings";
import { PM_BONUS } from "@/lib/scoring";

type SortKey = "rank" | "name" | "updated";

const SORT_LABELS: Record<SortKey, string> = { rank: "דירוג", name: "שם", updated: "עדכון אחרון" };

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

function sortBallots(ballots: BallotEntry[], key: SortKey) {
  const byName = (a: BallotEntry, b: BallotEntry) => a.name.localeCompare(b.name, "he");
  const sorted = [...ballots];
  if (key === "name") return sorted.sort(byName);
  if (key === "updated") return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b));
  return sorted.sort((a, b) => (a.score?.rank ?? Infinity) - (b.score?.rank ?? Infinity) || byName(a, b));
}

export function Participants({ config, ballots, realResults }: { config: PublicConfig; ballots: BallotEntry[]; realResults: RealResults }) {
  const scored = realResults !== null;
  const [sort, setSort] = useState<SortKey>(scored ? "rank" : "name");
  const keys: SortKey[] = scored ? ["rank", "name", "updated"] : ["name", "updated"];
  const candidateName = (id: string) => config.pmCandidates.find((c) => c.id === id)?.name ?? id;
  const rows = sortBallots(ballots, sort);

  return (
    <section aria-labelledby="participants-title" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 id="participants-title" className="text-lg font-bold">
          {scored ? "מי ניצח" : "המשתתפים"} ({ballots.length})
        </h2>
        {ballots.length > 1 && (
          <label className="flex items-center gap-1 text-sm text-slate-600">
            מיון
            <select
              aria-label="מיון"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {keys.map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {scored && (
        <p className="mt-1 text-sm text-slate-600">
          ניקוד = סכום הסטיות במנדטים, פחות {PM_BONUS} על ראש ממשלה נכון. נמוך יותר = טוב יותר.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">עדיין אף אחד.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {rows.map((b) => (
            <li key={b.name}>
              <details className="group py-2">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  {b.score && (
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${
                        b.score.rank === 1 ? "bg-amber-400 text-black" : "bg-slate-200 text-slate-800"
                      }`}
                      aria-label={`מקום ${b.score.rank}`}
                    >
                      {b.score.rank}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {'רה"מ: '}{candidateName(b.pmCandidateId)}
                      {b.score ? (b.score.pmCorrect ? " ✓" : " ✗") : ""} · {formatTime(b.updatedAt)}
                    </span>
                  </span>
                  {b.score && (
                    <span className="shrink-0 text-end">
                      <span className="block text-lg font-bold tabular-nums">{b.score.total}</span>
                      <span className="block text-xs text-slate-500">סטייה {b.score.deviation}</span>
                    </span>
                  )}
                  <span className="text-slate-400 transition group-open:rotate-180" aria-hidden>
                    ▾
                  </span>
                </summary>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-1 text-start font-normal">רשימה</th>
                      <th className="py-1 text-end font-normal">תחזית</th>
                      {realResults && <th className="py-1 text-end font-normal">בפועל</th>}
                      {realResults && <th className="py-1 text-end font-normal">פער</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {config.parties
                      .filter((p) => (b.seats[p.id] ?? 0) > 0 || (realResults?.seats[p.id] ?? 0) > 0)
                      .map((p) => {
                        const mine = b.seats[p.id] ?? 0;
                        const actual = realResults?.seats[p.id] ?? 0;
                        return (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="py-1">
                              <span className="me-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: p.color }} aria-hidden />
                              {p.name}
                            </td>
                            <td className="py-1 text-end tabular-nums">{mine}</td>
                            {realResults && <td className="py-1 text-end tabular-nums">{actual}</td>}
                            {realResults && (
                              <td className={`py-1 text-end tabular-nums ${mine === actual ? "text-green-700" : "text-slate-600"}`}>
                                {mine - actual > 0 ? `+${mine - actual}` : mine - actual}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
