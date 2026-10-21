"use client";

import { useState } from "react";

const SHARE_TEXT = "בואו לחזות את תוצאות הבחירות: חלקו 120 מנדטים ובחרו מי יהיה ראש הממשלה";

export function ShareButton() {
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    const url = window.location.origin + "/";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "מנדטים 2026", text: SHARE_TEXT, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage("הקישור הועתק");
    } catch {
      setMessage(`העתיקו את הקישור: ${url}`);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={share}
        className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-blue-900 ring-1 ring-blue-200"
      >
        שיתוף
      </button>
      <p role="status" className="mt-1 min-h-5 text-center text-sm text-slate-600">
        {message}
      </p>
    </div>
  );
}
