"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, NETWORK_ERROR, submitVote } from "@/lib/client-api";
import type { PublicConfig } from "@/lib/config";
import { restoreSeatMap, sumSeats } from "@/lib/seats";
import { useBallot } from "./BallotProvider";
import { useDevice } from "./DeviceProvider";
import { PmChoice } from "./PmChoice";
import { VoteReview } from "./VoteReview";

export function PmStep({ config }: { config: PublicConfig }) {
  const router = useRouter();
  const device = useDevice();
  const ballot = useBallot();
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(config.locked);
  // Set after a successful save so clearing the draft does not bounce back to /vote.
  const [submitted, setSubmitted] = useState(false);

  const savedVote = device.me?.vote ?? null;
  const rawSeats = ballot.draft.seats ?? savedVote?.seats ?? null;
  const seats = rawSeats ? restoreSeatMap(rawSeats, config.parties) : null;
  const seatsComplete = seats !== null && sumSeats(seats) === config.totalSeats;
  const activeIds = new Set(config.pmCandidates.map((c) => c.id));
  const preset = ballot.draft.pmCandidateId ?? savedVote?.pmCandidateId ?? null;
  const pmCandidateId = preset && activeIds.has(preset) ? preset : null;

  const ready = ballot.hydrated && device.status !== "loading";
  useEffect(() => {
    if (!ready || submitted) return;
    if (device.status === "anonymous") router.replace("/");
    else if (device.status === "ready" && !seatsComplete) router.replace("/vote");
  }, [ready, submitted, device.status, seatsComplete, router]);

  async function confirm() {
    if (!device.token || !seats || !pmCandidateId) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitVote(device.token, { seats, pmCandidateId });
      setSubmitted(true);
      await device.refresh();
      ballot.clear();
      router.push("/results");
    } catch (e) {
      setSubmitting(false);
      if (e instanceof ApiError && e.status === 423) {
        setLocked(true);
        setError(e.message);
      } else if (e instanceof ApiError && e.status === 401) {
        device.forget();
      } else {
        setError(e instanceof ApiError ? e.message : NETWORK_ERROR);
      }
    }
  }

  return (
    <main>
      <header className="pt-6 pb-3">
        <Link href="/vote" className="text-sm font-medium text-blue-800 underline">
          → חזרה לחלוקת המנדטים
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-blue-900">מי יהיה ראש הממשלה?</h1>
        <p className="mt-1 text-slate-700">בחרו מי לדעתכם ירכיב את הממשלה הבאה.</p>
      </header>

      {locked && (
        <p role="alert" className="mb-3 rounded-xl bg-amber-100 p-3 text-amber-900">
          ההצבעה נעולה ואי אפשר לשנות אותה.{" "}
          <Link href="/results" className="font-semibold underline">
            לתוצאות
          </Link>
        </p>
      )}

      {reviewing && seats && pmCandidateId ? (
        <VoteReview
          config={config}
          seats={seats}
          pmCandidateId={pmCandidateId}
          submitting={submitting}
          disabled={locked}
          onConfirm={confirm}
          onBack={() => setReviewing(false)}
        />
      ) : (
        <>
          <PmChoice
            candidates={config.pmCandidates}
            value={pmCandidateId}
            disabled={locked}
            onChange={(id) => {
              ballot.setPm(id);
              setError(null);
            }}
          />
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
            <div className="mx-auto max-w-xl">
              <button
                type="button"
                disabled={locked}
                onClick={() => (pmCandidateId ? setReviewing(true) : setError("יש לבחור אפשרות אחת"))}
                className="w-full rounded-xl bg-blue-800 px-4 py-3 text-lg font-bold text-white shadow disabled:bg-slate-400"
              >
                המשך לאישור
              </button>
            </div>
          </div>
        </>
      )}

      <p role="alert" className="mt-3 min-h-6 font-medium text-red-700">
        {locked ? null : error}
      </p>
    </main>
  );
}
