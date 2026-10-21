"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SeatMap } from "@/lib/seats";

/** The ballot being edited, kept across the seats → PM steps (and reloads, via sessionStorage). */
export type Draft = { seats: SeatMap | null; pmCandidateId: string | null };

const STORAGE_KEY = "mandatim2026.draft";
const EMPTY: Draft = { seats: null, pmCandidateId: null };

type BallotContextValue = {
  hydrated: boolean;
  draft: Draft;
  setSeats: (seats: SeatMap) => void;
  setPm: (id: string | null) => void;
  clear: () => void;
};

const BallotContext = createContext<BallotContextValue | null>(null);

function readStored(): Draft {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { seats: parsed.seats ?? null, pmCandidateId: parsed.pmCandidateId ?? null };
  } catch {
    return EMPTY;
  }
}

export function BallotProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDraft(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (draft.seats || draft.pmCandidateId) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [draft, hydrated]);

  const setSeats = useCallback((seats: SeatMap) => setDraft((d) => ({ ...d, seats })), []);
  const setPm = useCallback((pmCandidateId: string | null) => setDraft((d) => ({ ...d, pmCandidateId })), []);
  const clear = useCallback(() => setDraft(EMPTY), []);

  const value = useMemo(() => ({ hydrated, draft, setSeats, setPm, clear }), [hydrated, draft, setSeats, setPm, clear]);
  return <BallotContext.Provider value={value}>{children}</BallotContext.Provider>;
}

export function useBallot() {
  const value = useContext(BallotContext);
  if (!value) throw new Error("useBallot must be used inside <BallotProvider>");
  return value;
}
