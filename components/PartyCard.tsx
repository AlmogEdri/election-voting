import type { PublicParty } from "@/lib/config";
import { readableText } from "@/lib/ui";

type Props = {
  party: PublicParty;
  value: number;
  cap: number;
  total: number;
  disabled: boolean;
  onChange: (requested: number) => void;
};

export function PartyCard({ party, value, cap, total, disabled, onChange }: Props) {
  const inactive = disabled || party.withdrawn;
  const inputId = `seats-${party.id}`;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <li
      className="rounded-2xl border-s-8 bg-white p-4 shadow-sm ring-1 ring-slate-200"
      style={{ borderInlineStartColor: party.color }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-1 text-lg font-extrabold"
          style={{ background: party.color, color: readableText(party.color) }}
          aria-label={`אותיות הפתק: ${party.letters}`}
        >
          {party.letters}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-tight">
            <label htmlFor={inputId}>{party.name}</label>
            {party.withdrawn && (
              <span className="ms-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 align-middle text-xs font-semibold text-slate-700">
                פרש
              </span>
            )}
          </h3>
          <p className="truncate text-sm text-slate-600">
            {party.leader} · {party.bloc}
          </p>
        </div>
        <output htmlFor={inputId} className="text-3xl font-extrabold tabular-nums" aria-live="off">
          {value}
        </output>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {/* RTL: 0 is on the right, so − sits at the start and + at the end. */}
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={inactive || value <= 0}
          aria-label={`הורדת מנדט מ${party.name}`}
          className="h-11 w-11 shrink-0 rounded-full bg-slate-100 text-2xl font-bold text-slate-800 ring-1 ring-slate-300 disabled:opacity-40"
        >
          −
        </button>
        <input
          id={inputId}
          type="range"
          className="seat-range"
          min={0}
          max={total}
          step={1}
          value={value}
          disabled={inactive}
          aria-valuetext={`${value} מנדטים`}
          onChange={(e) => onChange(Number(e.target.value))}
          style={
            {
              "--seat-color": party.color,
              "--seat-fill": pct(value),
              "--seat-cap": pct(cap),
            } as React.CSSProperties
          }
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={inactive || value >= cap}
          aria-label={`הוספת מנדט ל${party.name}`}
          className="h-11 w-11 shrink-0 rounded-full bg-slate-100 text-2xl font-bold text-slate-800 ring-1 ring-slate-300 disabled:opacity-40"
        >
          +
        </button>
      </div>
      {party.withdrawn && <p className="mt-2 text-sm text-slate-600">הרשימה פרשה מהמרוץ; הפתק נשאר בקלפי.</p>}
    </li>
  );
}
