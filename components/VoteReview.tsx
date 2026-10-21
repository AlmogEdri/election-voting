import type { PublicConfig } from "@/lib/config";
import type { SeatMap } from "@/lib/seats";

type Props = {
  config: PublicConfig;
  seats: SeatMap;
  pmCandidateId: string;
  submitting: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onBack: () => void;
};

export function VoteReview({ config, seats, pmCandidateId, submitting, disabled, onConfirm, onBack }: Props) {
  const pm = config.pmCandidates.find((c) => c.id === pmCandidateId);
  const rows = config.parties.filter((p) => (seats[p.id] ?? 0) > 0);
  return (
    <section aria-labelledby="review-title" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 id="review-title" className="text-xl font-bold">
        אישור ההצבעה
      </h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-1.5">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="font-bold tabular-nums">{seats[p.id]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-slate-200 pt-3">
        ראש הממשלה: <strong>{pm?.name}</strong>
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting || disabled}
          className="flex-[2] rounded-xl bg-green-700 px-4 py-3 text-lg font-bold text-white disabled:opacity-60"
        >
          {submitting ? "שומרים…" : "אישור ושליחה"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-800 ring-1 ring-slate-300"
        >
          חזרה
        </button>
      </div>
    </section>
  );
}
