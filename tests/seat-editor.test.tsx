// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeatEditor } from "@/components/SeatEditor";
import { publicConfig } from "./fixtures/config";
import { SEED_SEATS } from "./fixtures/prd";
import { jsonResponse, mockFetch, Providers, renderWithProviders, resetBrowser, router, signIn } from "./helpers/ui";

vi.mock("next/navigation", async () => (await import("./helpers/next-mocks")).navigationMock());
vi.mock("next/link", async () => (await import("./helpers/next-mocks")).linkMock());

afterEach(resetBrowser);

const config = publicConfig();
const counter = () => screen.getByTestId("seat-counter").textContent;
const value = (name: string) => Number((screen.getByLabelText(name) as HTMLInputElement).value);
const slide = (name: string, n: number) => fireEvent.change(screen.getByLabelText(name), { target: { value: String(n) } });
const plus = (name: string) => fireEvent.click(screen.getByRole("button", { name: `הוספת מנדט ל${name}` }));
const minus = (name: string) => fireEvent.click(screen.getByRole("button", { name: `הורדת מנדט מ${name}` }));
const continueButton = () => screen.getByRole("button", { name: /^המשך/ }) as HTMLButtonElement;

async function renderEditor(vote: unknown = null, overrides = {}) {
  signIn();
  mockFetch({ "GET /api/me": () => jsonResponse({ user: { id: "u1", name: "דנה" }, vote }) });
  renderWithProviders(<SeatEditor config={{ ...config, ...overrides }} />);
  await screen.findByText(/דנה,/);
}

describe("seat editor", () => {
  it("server-renders labelled sliders and the sticky counter", () => {
    const html = renderToString(
      <Providers>
        <SeatEditor config={config} />
      </Providers>,
    );
    expect(html.match(/type="range"/g)).toHaveLength(14);
    expect(html).toContain('<label for="seats-likud">הליכוד</label>');
    expect(html).toMatch(/data-testid="seat-counter" class="sticky top-0/);
    expect(html).toContain("התחל מהסקרים");
    expect(html).toContain("אפס הכול");
  });

  it("starts from zero with continue disabled until the polls are loaded", async () => {
    await renderEditor();
    expect(counter()).toContain("הוקצו 0 / 120");
    expect(value("הליכוד")).toBe(0);
    expect(continueButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "התחל מהסקרים" }));
    expect(counter()).toContain("הוקצו 120 / 120");
    expect(value("הליכוד")).toBe(23);
    expect(continueButton().disabled).toBe(false);
    fireEvent.click(continueButton());
    expect(router.push).toHaveBeenCalledWith("/vote/prime-minister");
  });

  it("disables continue at 119 and shows what is left", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "התחל מהסקרים" }));
    minus("הליכוד");
    expect(value("הליכוד")).toBe(22);
    expect(counter()).toContain("הוקצו 119 / 120");
    expect(counter()).toContain("נותרו 1");
    expect(continueButton().disabled).toBe(true);
  });

  it("caps each list at its value plus the remaining seats", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "התחל מהסקרים" }));
    slide("הליכוד", 60);
    expect(value("הליכוד")).toBe(23);
    slide("הליכוד", 15);
    expect(counter()).toContain("נותרו 8");
    slide("עמך ישראל", 100);
    expect(value("עמך ישראל")).toBe(8);
    expect(counter()).toContain("הוקצו 120 / 120");
    plus("ש\"ס");
    expect(value("ש\"ס")).toBe(8);
  });

  it("jumps between 0 and 4 in both directions", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "אפס הכול" }));
    expect(counter()).toContain("הוקצו 0 / 120");
    plus("עמך ישראל");
    expect(value("עמך ישראל")).toBe(4);
    minus("עמך ישראל");
    expect(value("עמך ישראל")).toBe(0);
    slide("עמך ישראל", 2);
    expect(value("עמך ישראל")).toBe(4);
    slide("עמך ישראל", 6);
    slide("עמך ישראל", 3);
    expect(value("עמך ישראל")).toBe(0);
  });

  it("does not jump to 4 when fewer than 4 seats remain", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "התחל מהסקרים" }));
    slide("הליכוד", 21);
    plus("עמך ישראל");
    expect(value("עמך ישראל")).toBe(0);
  });

  it("resets and restores the poll defaults", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "התחל מהסקרים" }));
    expect(value("הליכוד")).toBe(23);
    fireEvent.click(screen.getByRole("button", { name: "אפס הכול" }));
    expect(value("הליכוד")).toBe(0);
    expect(continueButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "התחל מהסקרים" }));
    for (const party of config.parties) expect(value(party.name)).toBe(SEED_SEATS[party.id as keyof typeof SEED_SEATS]);
  });

  it("restores a saved ballot instead of the defaults", async () => {
    await renderEditor({ seats: { ...SEED_SEATS, likud: 19, amcha: 4 }, pmCandidateId: "netanyahu", updatedAt: "" });
    await waitFor(() => expect(value("עמך ישראל")).toBe(4));
    expect(value("הליכוד")).toBe(19);
  });

  it("prefers the in-progress draft over the saved ballot", async () => {
    window.sessionStorage.setItem(
      "mandatim2026.draft",
      JSON.stringify({ seats: { ...SEED_SEATS, likud: 15, amcha: 8 }, pmCandidateId: null }),
    );
    await renderEditor({ seats: { ...SEED_SEATS, likud: 19, amcha: 4 }, pmCandidateId: "netanyahu", updatedAt: "" });
    await waitFor(() => expect(value("עמך ישראל")).toBe(8));
  });

  it("keeps the withdrawn list disabled with a badge", async () => {
    await renderEditor();
    const slider = screen.getByLabelText("כחול לבן") as HTMLInputElement;
    expect(slider.disabled).toBe(true);
    const card = slider.closest("li")!;
    expect(within(card).getByText("פרש")).toBeTruthy();
    expect((within(card).getByRole("button", { name: /הוספת/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("is read-only when voting is locked", async () => {
    await renderEditor(null, { locked: true });
    expect(screen.getByRole("alert").textContent).toContain("ההצבעה נעולה");
    expect((screen.getByLabelText("הליכוד") as HTMLInputElement).disabled).toBe(true);
    expect(continueButton().disabled).toBe(true);
  });

  it("sends visitors without a token to registration", async () => {
    mockFetch({});
    await act(async () => {
      renderWithProviders(<SeatEditor config={config} />);
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });
});
