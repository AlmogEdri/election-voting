// Browser-side API client and device-token storage.
import type { PublicConfig } from "./config";
import type { SeatMap } from "./seats";
import type { SavedVote } from "./votes";

export const TOKEN_KEY = "mandatim2026.deviceToken";

export const tokenStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Private mode without storage: the session still works until reload.
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const NETWORK_ERROR = "בעיית תקשורת. בדקו את החיבור ונסו שוב.";

async function call<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? NETWORK_ERROR, res.status);
  return data as T;
}

export type Me = { user: { id: string; name: string }; vote: SavedVote | null };
export type Ballot = { seats: SeatMap; pmCandidateId: string };
export type BallotEntry = {
  name: string;
  seats: SeatMap;
  pmCandidateId: string;
  updatedAt: string;
  score: { deviation: number; pmCorrect: boolean; total: number; rank: number } | null;
};
export type PublicStats = {
  participants: number;
  avgSeats: Record<string, number>;
  pmShare: Record<string, number>;
  names: string[];
  ballots: BallotEntry[];
  realResults: { seats: SeatMap; pmCandidateId: string; enteredAt: string } | null;
  locked: boolean;
};

export const registerName = (name: string) =>
  call<{ userId: string; deviceToken: string; name: string }>("/api/register", { method: "POST", body: { name } });

export const fetchMe = (token: string) => call<Me>("/api/me", { headers: { "x-device-token": token } });

export const submitVote = (token: string, ballot: Ballot) =>
  call<{ ok: true }>("/api/vote", { method: "PUT", body: ballot, headers: { "x-device-token": token } });

export const fetchStats = () => call<PublicStats>("/api/stats");

export const fetchConfig = () => call<PublicConfig>("/api/parties");

export function adminCall<T>(secret: string, path: string, body?: unknown) {
  return call<T>(`/api/admin/${path}`, {
    method: body === undefined ? "GET" : "POST",
    body,
    headers: { "x-admin-secret": secret },
  });
}
