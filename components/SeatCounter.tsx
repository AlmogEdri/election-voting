export function SeatCounter({ allocated, total }: { allocated: number; total: number }) {
  const remaining = total - allocated;
  const complete = remaining === 0;
  return (
    <div
      data-testid="seat-counter"
      className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <p role="status" aria-live="polite" className="text-center text-lg font-bold">
        <span>
          הוקצו {allocated} / {total}
        </span>
        <span className="mx-2 text-slate-400">·</span>
        <span className={complete ? "text-green-700" : "text-amber-700"}>
          {complete ? "הכול הוקצה" : `נותרו ${remaining}`}
        </span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div
          className={`h-full rounded-full ${complete ? "bg-green-600" : "bg-blue-700"}`}
          style={{ width: `${(allocated / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
