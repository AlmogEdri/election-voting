// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PmStep } from "@/components/PmStep";
import { publicConfig } from "./fixtures/config";
import { PRD_PM_CANDIDATES, SEED_SEATS } from "./fixtures/prd";
import { jsonResponse, mockFetch, renderWithProviders, resetBrowser, router, signIn } from "./helpers/ui";

vi.mock("next/navigation", async () => (await import("./helpers/next-mocks")).navigationMock());
vi.mock("next/link", async () => (await import("./helpers/next-mocks")).linkMock());

afterEach(resetBrowser);

const config = publicConfig();
const DRAFT_KEY = "mandatim2026.draft";
const me = (vote: unknown = null) => jsonResponse({ user: { id: "u1", name: "דנה" }, vote });

function withDraft(seats: Record<string, number> = SEED_SEATS) {
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ seats, pmCandidateId: null }));
}

async function choose(name: RegExp) {
  fireEvent.click(await screen.findByRole("radio", { name }));
  fireEvent.click(screen.getByRole("button", { name: "המשך לאישור" }));
}

describe("prime-minister step", () => {
  it("lists the nine choices with 'בחירות נוספות' last", async () => {
    signIn();
    withDraft();
    mockFetch({ "GET /api/me": () => me() });
    renderWithProviders(<PmStep config={config} />);
    const radios = await screen.findAllByRole("radio");
    expect(radios).toHaveLength(9);
    const labels = radios.map((r) => r.closest("label")!.textContent!);
    PRD_PM_CANDIDATES.forEach((name, i) => expect(labels[i]).toContain(name));
    expect(labels.at(-1)).toContain("אף אחד לא מרכיב ממשלה");
    expect(labels[3]).toContain("ביחד (בנט–לפיד)");
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
  });

  it("requires a selection", async () => {
    signIn();
    withDraft();
    const fetch = mockFetch({ "GET /api/me": () => me() });
    renderWithProviders(<PmStep config={config} />);
    await screen.findAllByRole("radio");
    fireEvent.click(screen.getByRole("button", { name: "המשך לאישור" }));
    expect(screen.getByText("יש לבחור אפשרות אחת")).toBeTruthy();
    expect(screen.queryByText("אישור ההצבעה")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("submits exactly the draft seats and the chosen candidate, then shows results", async () => {
    signIn("tok-9");
    const seats = { ...SEED_SEATS, likud: 19, amcha: 4 };
    withDraft(seats);
    let meCalls = 0;
    const fetch = mockFetch({
      "GET /api/me": () => (++meCalls === 1 ? me() : me({ seats, pmCandidateId: "bennett", updatedAt: "" })),
      "PUT /api/vote": () => jsonResponse({ ok: true }),
    });
    renderWithProviders(<PmStep config={config} />);
    await choose(/נפתלי בנט/);
    expect(screen.getByText("אישור ההצבעה")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "אישור ושליחה" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/results"));

    const put = fetch.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(put[0]).toBe("/api/vote");
    expect((put[1]!.headers as Record<string, string>)["x-device-token"]).toBe("tok-9");
    expect(JSON.parse(put[1]!.body as string)).toEqual({ seats, pmCandidateId: "bennett" });
    await waitFor(() => expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it("can pick 'בחירות נוספות'", async () => {
    signIn();
    withDraft();
    const fetch = mockFetch({ "GET /api/me": () => me(), "PUT /api/vote": () => jsonResponse({ ok: true }) });
    renderWithProviders(<PmStep config={config} />);
    await choose(/בחירות נוספות/);
    fireEvent.click(screen.getByRole("button", { name: "אישור ושליחה" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/results"));
    const put = fetch.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(JSON.parse(put[1]!.body as string).pmCandidateId).toBe("new-elections");
    // Clearing the draft after saving must not bounce back to the seat screen.
    await new Promise((r) => setTimeout(r, 20));
    expect(router.replace).not.toHaveBeenCalledWith("/vote");
  });

  it("keeps the draft and shows the server error on 400", async () => {
    signIn();
    withDraft();
    mockFetch({ "GET /api/me": () => me(), "PUT /api/vote": () => jsonResponse({ error: "סכום המנדטים חייב להיות בדיוק 120" }, 400) });
    renderWithProviders(<PmStep config={config} />);
    await choose(/גדי איזנקוט/);
    fireEvent.click(screen.getByRole("button", { name: "אישור ושליחה" }));
    expect(await screen.findByText("סכום המנדטים חייב להיות בדיוק 120")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(JSON.parse(window.sessionStorage.getItem(DRAFT_KEY)!)).toMatchObject({ seats: SEED_SEATS, pmCandidateId: "eisenkot" });
  });

  it("switches to read-only on 423", async () => {
    signIn();
    withDraft();
    mockFetch({ "GET /api/me": () => me(), "PUT /api/vote": () => jsonResponse({ error: "ההצבעה נעולה" }, 423) });
    renderWithProviders(<PmStep config={config} />);
    await choose(/גדי איזנקוט/);
    fireEvent.click(screen.getByRole("button", { name: "אישור ושליחה" }));
    expect(await screen.findByText(/ההצבעה נעולה ואי אפשר לשנות אותה/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "אישור ושליחה" }) as HTMLButtonElement).disabled).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("returns to the seat screen when there is no complete allocation", async () => {
    signIn();
    withDraft({ ...SEED_SEATS, likud: 22 });
    mockFetch({ "GET /api/me": () => me() });
    renderWithProviders(<PmStep config={config} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/vote"));
  });
});
