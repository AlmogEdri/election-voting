"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PublicConfig } from "@/lib/config";
import { formatLockAt } from "@/lib/lock";
import {
  adjustSeats,
  defaultSeatMap,
  restoreSeatMap,
  seatCap,
  sumSeats,
  thresholdApplies,
  zeroSeats,
  type SeatMap,
} from "@/lib/seats";
import { useBallot } from "./BallotProvider";
import { useDevice } from "./DeviceProvider";
import { PartyCard } from "./PartyCard";
import { SeatCounter } from "./SeatCounter";

export function SeatEditor({ config }: { config: PublicConfig }) {
  const router = useRouter();
  const device = useDevice();
  const ballot = useBallot();
  const [seats, setSeatsState] = useState<SeatMap>(() => zeroSeats(config.parties));
  const initialized = useRef(false);
  const touched = useRef(false);

  useEffect(() => {
    if (device.status === "anonymous") router.replace("/");
  }, [device.status, router]);

  // Starting point, once identity and draft are known: current draft > saved vote > all zeros (the poll defaults stay behind the button).
  useEffect(() => {
    if (initialized.current || !ballot.hydrated || device.status === "loading") return;
    initialized.current = true;
    if (touched.current) return;
    const saved = ballot.draft.seats ?? device.me?.vote?.seats;
    if (saved) setSeatsState(restoreSeatMap(saved, config.parties));
  }, [ballot.hydrated, ballot.draft.seats, device.status, device.me, config.parties]);

  function update(next: SeatMap) {
    touched.current = true;
    setSeatsState(next);
    ballot.setSeats(next);
  }

  const allocated = sumSeats(seats);
  const complete = allocated === config.totalSeats;
  const locked = config.locked;

  return (
    <main>
      <header className="pt-6 pb-3">
        <h1 className="text-2xl font-extrabold text-blue-900">חלוקת המנדטים</h1>
        <p className="mt-1 text-slate-700">
          {device.me ? `${device.me.user.name}, ` : ""}הזיזו את הסליידרים עד שכל {config.totalSeats} המנדטים מחולקים.
        </p>
        {thresholdApplies(config.minSeats) && (
          <p className="mt-1 text-sm text-slate-600">
            אחוז החסימה: רשימה מקבלת 0 או לפחות {config.minSeats} מנדטים.
          </p>
        )}
      </header>

      {locked && (
        <p role="alert" className="mb-3 rounded-xl bg-amber-100 p-3 text-amber-900">
          ההצבעה נעולה{config.lockAt ? ` מאז ${formatLockAt(config.lockAt)}` : ""}. אפשר רק לצפות.{" "}
          <Link href="/results" className="font-semibold underline">
            לתוצאות
          </Link>
        </p>
      )}

      <SeatCounter allocated={allocated} total={config.totalSeats} />

      <div className="my-3 flex gap-2">
        <button
          type="button"
          disabled={locked}
          onClick={() => update(defaultSeatMap(config.parties))}
          className="flex-1 rounded-xl bg-white px-3 py-2.5 font-semibold text-blue-900 ring-1 ring-blue-200 disabled:opacity-50"
        >
          התחל מהסקרים
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => update(zeroSeats(config.parties))}
          className="flex-1 rounded-xl bg-white px-3 py-2.5 font-semibold text-slate-800 ring-1 ring-slate-300 disabled:opacity-50"
        >
          אפס הכול
        </button>
      </div>

      <ul className="space-y-3">
        {config.parties.map((party) => (
          <PartyCard
            key={party.id}
            party={party}
            value={seats[party.id] ?? 0}
            cap={seatCap(seats, party.id)}
            total={config.totalSeats}
            disabled={locked}
            onChange={(requested) => update(adjustSeats(seats, party.id, requested, config.minSeats))}
          />
        ))}
        <li className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
          <span className="font-bold">אחר</span> · עוד {config.otherListsCount} רשימות שאושרו ולא מופיעות בסקרים. לא מקבלות
          מנדטים בתחזית.
        </li>
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            disabled={!complete || locked}
            onClick={() => router.push("/vote/prime-minister")}
            className="w-full rounded-xl bg-blue-800 px-4 py-3 text-lg font-bold text-white shadow disabled:bg-slate-400"
          >
            {complete ? "המשך לבחירת ראש הממשלה" : `המשך (נותרו ${config.totalSeats - allocated})`}
          </button>
        </div>
      </div>
    </main>
  );
}
