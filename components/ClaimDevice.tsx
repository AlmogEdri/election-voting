"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { tokenStore } from "@/lib/client-api";

/** /claim?token=… stores a device token on this phone and reloads into the ballot, so an
 *  account created elsewhere (for example through the API) can be used here. */
export function ClaimDevice() {
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || token.length < 20) {
      setError("הקישור חסר או שגוי.");
      return;
    }
    tokenStore.set(token);
    // Full reload so DeviceProvider reads the new token from storage.
    window.location.replace("/vote");
  }, [token]);

  return <p className="mt-3 text-slate-700">{error ?? "מעבירים אותך להצבעה שלך…"}</p>;
}
