import { render } from "@testing-library/react";
import { vi } from "vitest";
import { BallotProvider } from "@/components/BallotProvider";
import { DeviceProvider } from "@/components/DeviceProvider";
import { TOKEN_KEY } from "@/lib/client-api";

export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DeviceProvider>
      <BallotProvider>{children}</BallotProvider>
    </DeviceProvider>
  );
}

export function renderWithProviders(ui: React.ReactElement) {
  return render(<Providers>{ui}</Providers>);
}

type Handler = (init: RequestInit & { headers: Record<string, string> }) => Response | Promise<Response>;

/** Routes fetch calls by "METHOD /path"; unknown routes fail the test loudly. */
export function mockFetch(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${String(input)}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected fetch ${key}`);
    return handler({ ...init, headers: (init.headers ?? {}) as Record<string, string> });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export const jsonResponse = (data: unknown, status = 200) => Response.json(data, { status });

export function signIn(token = "device-token") {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function resetBrowser() {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  for (const fn of Object.values(router)) fn.mockReset();
}
