import type { PublicCandidate } from "@/lib/config";
import { NEW_ELECTIONS_ID } from "@/lib/defaults";
import { initials } from "@/lib/ui";

type Props = {
  candidates: PublicCandidate[];
  value: string | null;
  disabled?: boolean;
  onChange: (id: string) => void;
};

export function PmChoice({ candidates, value, disabled, onChange }: Props) {
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="sr-only">מי יהיה ראש הממשלה?</legend>
      {candidates.map((c) => {
        const newElections = c.id === NEW_ELECTIONS_ID;
        const checked = value === c.id;
        return (
          <label
            key={c.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-2 transition ${
              checked ? "ring-blue-700" : "ring-slate-200"
            } ${newElections ? "mt-4" : ""}`}
          >
            <input
              type="radio"
              name="pm"
              value={c.id}
              checked={checked}
              onChange={() => onChange(c.id)}
              className="h-5 w-5 shrink-0 accent-blue-800"
            />
            <span
              aria-hidden
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                newElections ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900"
              }`}
            >
              {newElections ? "↻" : initials(c.name)}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{c.name}</span>
              <span className="block text-sm text-slate-600">
                {newElections ? "אף אחד לא מרכיב ממשלה והולכים לסבב נוסף" : c.partyName}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
