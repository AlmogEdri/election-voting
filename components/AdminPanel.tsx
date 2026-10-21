"use client";

import { useCallback, useState } from "react";
import { adminCall, ApiError, NETWORK_ERROR } from "@/lib/client-api";
import { formatLockAt, type LockMode } from "@/lib/lock";

type AdminUser = { id: string; name: string; voted: boolean; createdAt: string };
type AdminState = {
  lockMode: LockMode;
  lockAt: string | null;
  locked: boolean;
  minSeats: number;
  realResults: unknown;
  users: AdminUser[];
};
type Feedback = { kind: "ok" | "error"; text: string } | null;

const message = (e: unknown) => (e instanceof ApiError ? e.message : NETWORK_ERROR);

/** ISO → value for <input type="datetime-local"> in the browser's local time. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Notice({ feedback, id }: { feedback: Feedback; id: string }) {
  return (
    <p id={id} role={feedback?.kind === "error" ? "alert" : "status"} className={`mt-2 min-h-5 text-sm font-medium ${feedback?.kind === "error" ? "text-red-700" : "text-green-700"}`}>
      {feedback?.text}
    </p>
  );
}

const sectionClass = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200";
const buttonClass = "rounded-lg bg-blue-800 px-3 py-2 font-semibold text-white disabled:opacity-50";
const secondaryClass = "rounded-lg bg-white px-3 py-2 font-semibold text-slate-800 ring-1 ring-slate-300 disabled:opacity-50";

export function AdminPanel() {
  // The secret lives only in component memory: never in the URL or storage.
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [state, setState] = useState<AdminState | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [lockAtInput, setLockAtInput] = useState("");
  const [minSeatsInput, setMinSeatsInput] = useState("");
  const [configJson, setConfigJson] = useState("");
  const [resultsJson, setResultsJson] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [busy, setBusy] = useState(false);

  const say = (section: string, value: Feedback) => setFeedback((f) => ({ ...f, [section]: value }));

  const loadState = useCallback(async (key: string) => {
    const next = await adminCall<AdminState>(key, "settings");
    setState(next);
    setLockAtInput(toLocalInput(next.lockAt));
    setMinSeatsInput(String(next.minSeats));
    setResultsJson(next.realResults ? JSON.stringify(next.realResults, null, 2) : "");
    return next;
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoginError(null);
    try {
      await loadState(secret);
      const config = await adminCall<unknown>(secret, "configuration");
      setConfigJson(JSON.stringify(config, null, 2));
      setAuthed(true);
    } catch (e) {
      setLoginError(message(e));
    }
  }

  async function run(section: string, path: string, body: unknown, success: string) {
    setBusy(true);
    say(section, null);
    try {
      await adminCall(secret, path, body);
      await loadState(secret);
      say(section, { kind: "ok", text: success });
      return true;
    } catch (e) {
      say(section, { kind: "error", text: message(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function parseJson(section: string, text: string): { ok: true; value: unknown } | { ok: false } {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      say(section, { kind: "error", text: "JSON לא תקין" });
      return { ok: false };
    }
  }

  if (!authed || !state) {
    return (
      <form onSubmit={login} className={`${sectionClass} mt-8 space-y-3`}>
        <label htmlFor="admin-secret" className="block font-semibold">
          סיסמת ניהול
        </label>
        <input
          id="admin-secret"
          type="password"
          autoComplete="current-password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          aria-describedby="login-error"
        />
        <p id="login-error" role="alert" className="min-h-5 text-sm font-medium text-red-700">
          {loginError}
        </p>
        <button type="submit" className={`${buttonClass} w-full`}>
          כניסה
        </button>
      </form>
    );
  }

  const modeLabel: Record<LockMode, string> = { scheduled: "לפי מועד", open: "פתוחה ידנית", closed: "נעולה ידנית" };

  return (
    <div className="space-y-4 pt-4">
      <section className={sectionClass} aria-labelledby="lock-title">
        <h2 id="lock-title" className="text-lg font-bold">
          נעילת ההצבעה
        </h2>
        <p className="mt-1">
          מצב: <strong>{state.locked ? "נעולה" : "פתוחה"}</strong> ({modeLabel[state.lockMode]})
          {state.lockAt && <> · מועד נעילה: {formatLockAt(state.lockAt)}</>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => run("lock", "settings", { lockMode: "closed" }, "ההצבעה ננעלה")}>
            נעל עכשיו
          </button>
          <button type="button" className={secondaryClass} disabled={busy} onClick={() => run("lock", "settings", { lockMode: "open" }, "ההצבעה נפתחה")}>
            פתח
          </button>
        </div>
        <label htmlFor="lock-at" className="mt-3 block text-sm font-semibold">
          נעילה אוטומטית במועד (שעון המכשיר)
        </label>
        <div className="mt-1 flex gap-2">
          <input id="lock-at" type="datetime-local" value={lockAtInput} onChange={(e) => setLockAtInput(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-2" />
          <button
            type="button"
            className={secondaryClass}
            disabled={busy || !lockAtInput}
            onClick={() => run("lock", "settings", { lockMode: "scheduled", lockAt: new Date(lockAtInput).toISOString() }, "נקבע מועד נעילה")}
          >
            קבע
          </button>
        </div>
        <Notice id="lock-feedback" feedback={feedback.lock ?? null} />
      </section>

      <section className={sectionClass} aria-labelledby="threshold-title">
        <h2 id="threshold-title" className="text-lg font-bold">
          אחוז חסימה
        </h2>
        <label htmlFor="min-seats" className="mt-1 block text-sm">
          מינימום מנדטים לרשימה (0 = כבוי)
        </label>
        <div className="mt-1 flex gap-2">
          <input id="min-seats" type="number" min={0} max={120} inputMode="numeric" value={minSeatsInput} onChange={(e) => setMinSeatsInput(e.target.value)} className="w-24 rounded-lg border border-slate-300 px-2 py-2" />
          <button type="button" className={secondaryClass} disabled={busy} onClick={() => run("threshold", "settings", { minSeats: Number(minSeatsInput) }, "נשמר")}>
            שמור
          </button>
        </div>
        <Notice id="threshold-feedback" feedback={feedback.threshold ?? null} />
      </section>

      <section className={sectionClass} aria-labelledby="config-title">
        <h2 id="config-title" className="text-lg font-bold">
          רשימות ומועמדים (JSON)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          רשימה או מועמד שיוסרו מה-JSON יסומנו כלא פעילים (לא יימחקו). סכום defaultSeats חייב להיות 120, ו-new-elections חייב להישאר.
        </p>
        <label htmlFor="config-json" className="sr-only">
          JSON של רשימות ומועמדים
        </label>
        <textarea id="config-json" dir="ltr" rows={14} value={configJson} onChange={(e) => setConfigJson(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" />
        <button
          type="button"
          className={`${buttonClass} mt-2`}
          disabled={busy}
          onClick={async () => {
            const parsed = parseJson("config", configJson);
            if (parsed.ok && (await run("config", "configuration", parsed.value, "הרשימות נשמרו"))) {
              setConfigJson(JSON.stringify(await adminCall(secret, "configuration"), null, 2));
            }
          }}
        >
          שמור רשימות ומועמדים
        </button>
        <Notice id="config-feedback" feedback={feedback.config ?? null} />
      </section>

      <section className={sectionClass} aria-labelledby="results-title">
        <h2 id="results-title" className="text-lg font-bold">
          תוצאות אמת
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {'{"seats": {"likud": 30, ...}, "pmCandidateId": "netanyahu"}'} · נשמר לחישוב הניקוד בשלב 2.
        </p>
        <label htmlFor="results-json" className="sr-only">
          JSON של תוצאות האמת
        </label>
        <textarea id="results-json" dir="ltr" rows={6} value={resultsJson} onChange={(e) => setResultsJson(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => {
              const parsed = parseJson("results", resultsJson);
              if (parsed.ok) void run("results", "real-results", parsed.value, "התוצאות נשמרו");
            }}
          >
            שמור תוצאות
          </button>
          <button type="button" className={secondaryClass} disabled={busy} onClick={() => run("results", "real-results", { clear: true }, "התוצאות נמחקו")}>
            נקה
          </button>
        </div>
        <Notice id="results-feedback" feedback={feedback.results ?? null} />
      </section>

      <section className={sectionClass} aria-labelledby="users-title">
        <h2 id="users-title" className="text-lg font-bold">
          משתמשים ({state.users.length})
        </h2>
        <ul className="mt-2 divide-y divide-slate-100">
          {state.users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {user.name} <span className="text-sm text-slate-500">{user.voted ? "· הצביע" : "· לא הצביע"}</span>
              </span>
              {confirmDelete === user.id ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white"
                    disabled={busy}
                    onClick={async () => {
                      await run("users", "delete-user", { userId: user.id }, `${user.name} נמחק`);
                      setConfirmDelete(null);
                    }}
                  >
                    כן, למחוק את {user.name}
                  </button>
                  <button type="button" className={secondaryClass} onClick={() => setConfirmDelete(null)}>
                    ביטול
                  </button>
                </span>
              ) : (
                <button type="button" className="text-sm font-semibold text-red-700 underline" onClick={() => setConfirmDelete(user.id)}>
                  מחיקה
                </button>
              )}
            </li>
          ))}
        </ul>
        <Notice id="users-feedback" feedback={feedback.users ?? null} />
      </section>
    </div>
  );
}
