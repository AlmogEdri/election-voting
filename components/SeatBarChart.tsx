"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SeatRow = { name: string; color: string; mine: number | null; average: number };

/** Horizontal bars, laid out right-to-left: names on the right, bars grow leftwards. */
export default function SeatBarChart({ rows, showMine }: { rows: SeatRow[]; showMine: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={rows.length * (showMine ? 44 : 30) + 50}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 4 }} barGap={2}>
        <XAxis type="number" reversed domain={[0, "dataMax"]} allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="name"
          orientation="right"
          width={120}
          tick={{ fontSize: 12, textAnchor: "start", dx: 112 }}
          interval={0}
        />
        <Tooltip formatter={(value) => [value, undefined]} />
        <Legend verticalAlign="top" height={28} />
        {showMine && <Bar dataKey="mine" name="ההצבעה שלי" fill="#1e40af" radius={3} />}
        <Bar dataKey="average" name="ממוצע כולם" fill="#94a3b8" radius={3} />
      </BarChart>
    </ResponsiveContainer>
  );
}
