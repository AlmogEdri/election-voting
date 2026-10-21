// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";
import { AdminPanel } from "@/components/AdminPanel";
import { jsonResponse, mockFetch, renderWithProviders, resetBrowser } from "./helpers/ui";

afterEach(resetBrowser);

const SECRET = "s3cret-value";
const state = {
  lockMode: "scheduled",
  lockAt: "2026-10-27T20:00:00.000Z",
  locked: false,
  minSeats: 4,
  realResults: null,
  users: [
    { id: "u1", name: "דני", voted: true, createdAt: "" },
    { id: "u2", name: "רותם", voted: false, createdAt: "" },
  ],
};
const configuration = { parties: [{ id: "likud" }], pmCandidates: [{ id: "new-elections" }] };

function adminRoutes(extra: Record<string, Parameters<typeof mockFetch>[0][string]> = {}) {
  const check = (headers: Record<string, string>) => {
    if (headers["x-admin-secret"] !== SECRET) return jsonResponse({ error: "סיסמת ניהול שגויה" }, 401);
    return null;
  };
  return mockFetch({
    "GET /api/admin/settings": ({ headers }) => check(headers) ?? jsonResponse(state),
    "GET /api/admin/configuration": ({ headers }) => check(headers) ?? jsonResponse(configuration),
    ...extra,
  });
}

async function login(secret = SECRET) {
  fireEvent.change(screen.getByLabelText("סיסמת ניהול"), { target: { value: secret } });
  fireEvent.click(screen.getByRole("button", { name: "כניסה" }));
}

describe("admin panel", () => {
  it("server-renders only the password form", () => {
    const html = renderToString(<AdminPage />);
    expect(html).toContain('type="password"');
    expect(html).toContain("סיסמת ניהול");
    expect(html).not.toContain("נעל עכשיו");
  });

  it("rejects a wrong password", async () => {
    adminRoutes();
    renderWithProviders(<AdminPanel />);
    await login("wrong");
    expect(await screen.findByText("סיסמת ניהול שגויה")).toBeTruthy();
    expect(screen.queryByText("נעילת ההצבעה")).toBeNull();
  });

  it("logs in with the secret header and shows every control, keeping the secret out of storage and URL", async () => {
    const fetch = adminRoutes();
    renderWithProviders(<AdminPanel />);
    await login();
    await screen.findByText("נעילת ההצבעה");
    for (const [, init] of fetch.mock.calls) expect((init!.headers as Record<string, string>)["x-admin-secret"]).toBe(SECRET);
    for (const name of ["נעל עכשיו", "פתח", "קבע", "שמור", "שמור רשימות ומועמדים", "שמור תוצאות", "נקה"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByLabelText("נעילה אוטומטית במועד (שעון המכשיר)")).toBeTruthy();
    expect((screen.getByLabelText("מינימום מנדטים לרשימה (0 = כבוי)") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("JSON של רשימות ומועמדים") as HTMLTextAreaElement).value).toContain('"likud"');
    expect(screen.getByLabelText("JSON של תוצאות האמת")).toBeTruthy();
    expect(screen.getByText(/27\.10\.2026/)).toBeTruthy();

    expect(JSON.stringify({ ...window.localStorage })).not.toContain(SECRET);
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(SECRET);
    expect(window.location.href).not.toContain(SECRET);
  });

  it("locks voting with an authenticated request", async () => {
    const lock = vi.fn(() => jsonResponse({ ok: true }));
    const fetch = adminRoutes({ "POST /api/admin/settings": lock });
    renderWithProviders(<AdminPanel />);
    await login();
    fireEvent.click(await screen.findByRole("button", { name: "נעל עכשיו" }));
    expect(await screen.findByText("ההצבעה ננעלה")).toBeTruthy();
    const call = fetch.mock.calls.find(([url, init]) => url === "/api/admin/settings" && init?.method === "POST")!;
    expect(JSON.parse(call[1]!.body as string)).toEqual({ lockMode: "closed" });
    expect((call[1]!.headers as Record<string, string>)["x-admin-secret"]).toBe(SECRET);
  });

  it("shows a rejected configuration edit next to the editor", async () => {
    adminRoutes({ "POST /api/admin/configuration": () => jsonResponse({ error: "סכום ברירות המחדל חייב להיות 120 (כרגע 119)" }, 400) });
    renderWithProviders(<AdminPanel />);
    await login();
    fireEvent.click(await screen.findByRole("button", { name: "שמור רשימות ומועמדים" }));
    const feedback = await screen.findByText("סכום ברירות המחדל חייב להיות 120 (כרגע 119)");
    expect(feedback.id).toBe("config-feedback");
  });

  it("reports invalid JSON without calling the server", async () => {
    const fetch = adminRoutes();
    renderWithProviders(<AdminPanel />);
    await login();
    const editor = await screen.findByLabelText("JSON של רשימות ומועמדים");
    const calls = fetch.mock.calls.length;
    fireEvent.change(editor, { target: { value: "{broken" } });
    fireEvent.click(screen.getByRole("button", { name: "שמור רשימות ומועמדים" }));
    expect((await screen.findByText("JSON לא תקין")).id).toBe("config-feedback");
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it("asks for confirmation before deleting a user", async () => {
    const remove = vi.fn(() => jsonResponse({ ok: true }));
    adminRoutes({ "POST /api/admin/delete-user": remove });
    renderWithProviders(<AdminPanel />);
    await login();
    fireEvent.click((await screen.findAllByRole("button", { name: "מחיקה" }))[0]);
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "ביטול" }));
    expect(screen.queryByRole("button", { name: /כן, למחוק/ })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "מחיקה" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "כן, למחוק את דני" }));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    const [init] = remove.mock.calls[0] as unknown as [RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ userId: "u1" });
    expect(await screen.findByText("דני נמחק")).toBeTruthy();
  });
});
