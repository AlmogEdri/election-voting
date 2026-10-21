"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, fetchMe, registerName, tokenStore, type Me } from "@/lib/client-api";

/**
 * loading:   checking the stored token
 * anonymous: no (valid) token on this device
 * ready:     registered; `me` holds the user and their saved vote
 * error:     the server could not be reached; the token is kept
 */
export type DeviceStatus = "loading" | "anonymous" | "ready" | "error";

type DeviceContextValue = {
  status: DeviceStatus;
  token: string | null;
  me: Me | null;
  register: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
  forget: () => void;
};

const DeviceContext = createContext<DeviceContextValue | null>(null);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<DeviceStatus>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const forget = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setMe(null);
    setStatus("anonymous");
  }, []);

  const load = useCallback(
    async (current: string | null) => {
      if (!current) {
        setStatus("anonymous");
        return;
      }
      try {
        setMe(await fetchMe(current));
        setStatus("ready");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) forget();
        else setStatus("error");
      }
    },
    [forget],
  );

  useEffect(() => {
    const stored = tokenStore.get();
    setToken(stored);
    void load(stored);
  }, [load]);

  const register = useCallback(async (name: string) => {
    const result = await registerName(name);
    tokenStore.set(result.deviceToken);
    setToken(result.deviceToken);
    setMe({ user: { id: result.userId, name: result.name }, vote: null });
    setStatus("ready");
  }, []);

  const refresh = useCallback(() => load(token), [load, token]);

  const value = useMemo(
    () => ({ status, token, me, register, refresh, forget }),
    [status, token, me, register, refresh, forget],
  );
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("useDevice must be used inside <DeviceProvider>");
  return value;
}
