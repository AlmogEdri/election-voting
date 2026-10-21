"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, NETWORK_ERROR } from "@/lib/client-api";
import { NAME_MAX, NAME_MIN, validateName } from "@/lib/validation";
import { useDevice } from "./DeviceProvider";

export function RegistrationForm() {
  const router = useRouter();
  const device = useDevice();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A device that already registered goes straight to its ballot.
  useEffect(() => {
    if (device.status === "ready") router.replace("/vote");
  }, [device.status, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const check = validateName(name);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await device.register(check.value.name);
      router.push("/vote");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : NETWORK_ERROR);
      setSubmitting(false);
    }
  }

  if (device.status === "ready") {
    return <p className="py-6 text-center text-slate-600">ממשיכים להצבעה שלך…</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <label htmlFor="name" className="block text-lg font-semibold">
        השם שלך
      </label>
      <input
        id="name"
        name="name"
        type="text"
        autoComplete="nickname"
        enterKeyHint="go"
        minLength={NAME_MIN}
        maxLength={NAME_MAX + 10}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby="name-hint name-error"
        placeholder="לדוגמה: דני כ."
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
      />
      <p id="name-hint" className="text-sm text-slate-600">
        {NAME_MIN}–{NAME_MAX} תווים. השם יופיע ברשימת המשתתפים.
      </p>
      <p id="name-error" role="alert" className="min-h-6 text-sm font-medium text-red-700">
        {error}
      </p>
      {device.status === "error" && (
        <p className="text-sm text-amber-800">לא הצלחנו לבדוק את ההרשמה הקודמת שלך. אפשר לנסות לרענן את הדף.</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-blue-800 px-4 py-3 text-lg font-bold text-white shadow hover:bg-blue-900 disabled:opacity-60"
      >
        {submitting ? "רושמים…" : "להצבעה"}
      </button>
    </form>
  );
}
