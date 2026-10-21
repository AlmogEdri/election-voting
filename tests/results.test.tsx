// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POLL_INTERVAL_MS, Results } from "@/components/Results";
import type { PublicStats } from "@/lib/client-api";
import { publicConfig } from "./fixtures/config";
import { SEED_SEATS } from "./fixtures/prd";
import { jsonResponse, mockFetch, renderWithProviders, resetBrowser, signIn } from "./helpers/ui";

vi.mock("next/navigation", async () => (await import("./helpers/next-mocks")).navigationMock());
vi.mock("next/link", async () => (await import("./helpers/next-mocks")).linkMock());
vi.mock("next/dynamic", async () => (await import("./helpers/next-mocks")).dynamicMock());

afterEach(() => {
  vi.useRealTimers();
  resetBrowser();
});

const config = publicConfig();
const stats: PublicStats = {
  participants: 2,
  avgSeats: { ...SEED_SEATS, likud: 20.5, amcha: 2.5 },
  pmShare: { netanyahu: 50, bennett: 50, eisenkot: 0, "new-elections": 0 },
  names: ["אבי", "בתיה"],
  ballots: [
    { name: "אבי", seats: { ...SEED_SEATS, likud: 18, amcha: 5 }, pmCandidateId: "bennett", updatedAt: "2026-10-21T10:00:00Z", score: null },
    { name: "בתיה", seats: SEED_SEATS, pmCandidateId: "netanyahu", updatedAt: "2026-10-21T11:00:00Z", score: null },
  ],
  realResults: null,
  locked: false,
};
const myVote = { seats: { ...SEED_SEATS, likud: 18, amcha: 5 }, pmCandidateId: "bennett", updatedAt: "" };

function renderResults(initial: PublicStats = stats, vote: unknown = myVote, extraRoutes = {}) {
  signIn();
  const fetch = mockFetch({ "GET /api/me": () => jsonResponse({ user: { id: "u1", name: "אבי" }, vote }), ...extraRoutes });
  const view = renderWithProviders(<Results config={config} initialStats={initial} />);
  return { fetch, ...view };
}

describe("results", () => {
  it("shows my vote against the average, PM shares and voter names", async () => {
    const { container } = renderResults();
    await screen.findByText("ההצבעה שלי מול ממוצע כולם");
    const html = container.innerHTML;
    expect(html).toContain("ההצבעה שלי");
    expect(html).toContain("ממוצע כולם");
    expect(html).toContain("50%");
    expect(html).toContain("אבי");
    expect(html).toContain("בתיה");
    expect(screen.getByText("2 משתתפים הצביעו", { exact: false })).toBeTruthy();

    const likudRow = screen.getByRole("rowheader", { name: /הליכוד/ }).closest("tr")!;
    expect(likudRow.textContent).toContain("18");
    expect(likudRow.textContent).toContain("20.5");
    expect(screen.getByText("נפתלי בנט", { selector: "strong" })).toBeTruthy();
  });

  it("offers editing while open", async () => {
    renderResults();
    expect(await screen.findByRole("link", { name: "ערוך את ההצבעה שלי" })).toBeTruthy();
  });

  it("hides editing once locked", async () => {
    renderResults({ ...stats, locked: true });
    await screen.findByText("ההצבעה שלי מול ממוצע כולם");
    expect(screen.queryByRole("link", { name: "ערוך את ההצבעה שלי" })).toBeNull();
    expect(screen.getByText(/ההצבעה נעולה/)).toBeTruthy();
  });

  it("polls every 30 seconds and stops after unmount", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const statsHandler = vi.fn(() => jsonResponse({ ...stats, participants: 3, names: [...stats.names, "גיל"], ballots: [...stats.ballots, { ...stats.ballots[1], name: "גיל" }] }));
    const { unmount } = renderResults(stats, myVote, { "GET /api/stats": statsHandler });
    await screen.findByText("ההצבעה שלי מול ממוצע כולם");

    vi.advanceTimersByTime(POLL_INTERVAL_MS - 1);
    expect(statsHandler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await screen.findByText("גיל");
    expect(statsHandler).toHaveBeenCalledTimes(1);

    unmount();
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    expect(statsHandler).toHaveBeenCalledTimes(1);
  });

  it("uses the Web Share API when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    try {
      renderResults();
      fireEvent.click(await screen.findByRole("button", { name: "שיתוף" }));
      await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: "http://localhost:3000/" })));
    } finally {
      delete (navigator as { share?: unknown }).share;
    }
  });

  it("falls back to copying the link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderResults();
    fireEvent.click(await screen.findByRole("button", { name: "שיתוף" }));
    expect(await screen.findByText("הקישור הועתק")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/");
  });

  it("shows only the average for visitors who have not voted", async () => {
    renderResults(stats, null);
    expect(await screen.findByRole("link", { name: "להצבעה שלי" })).toBeTruthy();
    expect(screen.queryByText("ההצבעה שלי מול ממוצע כולם")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "ממוצע כולם" })).toBeTruthy();
  });

  it("lists every ballot with its PM call, sortable by last update", async () => {
    renderResults();
    await screen.findByText("המשתתפים (2)");
    const items = () => screen.getAllByRole("listitem").filter((li) => li.querySelector("details")).map((li) => li.textContent ?? "");
    expect(items()[0]).toContain("אבי");
    expect(items()[0]).toContain("נפתלי בנט");
    expect(items()[0]).toContain("הליכוד18");
    fireEvent.change(screen.getByRole("combobox", { name: "מיון" }), { target: { value: "updated" } });
    expect(items()[0]).toContain("בתיה");
  });

  it("shows the leaderboard once official results exist", async () => {
    const real = { seats: { ...SEED_SEATS, likud: 18, amcha: 5 }, pmCandidateId: "bennett", enteredAt: "2026-10-28T06:00:00Z" };
    const scored: PublicStats = {
      ...stats,
      realResults: real,
      ballots: [
        { ...stats.ballots[1], score: { deviation: 10, pmCorrect: false, total: 10, rank: 2 } },
        { ...stats.ballots[0], score: { deviation: 0, pmCorrect: true, total: -10, rank: 1 } },
      ],
    };
    renderResults(scored);
    await screen.findByText("מי ניצח (2)");
    expect(screen.getByText(/התוצאות האמיתיות הוזנו/).textContent).toContain("נפתלי בנט");
    const items = screen.getAllByRole("listitem").filter((li) => li.querySelector("details")).map((li) => li.textContent ?? "");
    expect(items[0]).toContain("אבי");
    expect(items[0]).toContain("-10");
    expect(items[0]).toContain("✓");
    expect(screen.getByLabelText("מקום 1").textContent).toBe("1");
    expect(items[1]).toContain("סטייה 10");
  });
});
