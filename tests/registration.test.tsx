// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { RegistrationForm } from "@/components/RegistrationForm";
import { TOKEN_KEY } from "@/lib/client-api";
import { jsonResponse, mockFetch, Providers, renderWithProviders, resetBrowser, router, signIn } from "./helpers/ui";

vi.mock("next/navigation", async () => (await import("./helpers/next-mocks")).navigationMock());
vi.mock("next/link", async () => (await import("./helpers/next-mocks")).linkMock());

afterEach(resetBrowser);

function submit(name: string) {
  fireEvent.change(screen.getByLabelText("השם שלך"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "להצבעה" }));
}

describe("registration", () => {
  it("server-renders the Hebrew intro, a labelled name field and the submit button", () => {
    const html = renderToString(
      <Providers>
        <HomePage />
      </Providers>,
    );
    expect(html).toContain("מנדטים 2026");
    expect(html).toContain('<label for="name"');
    expect(html).toContain('id="name"');
    expect(html).toMatch(/<button type="submit"[^>]*>להצבעה<\/button>/);
  });

  it("registers, stores the device token and goes to the ballot", async () => {
    const fetch = mockFetch({
      "POST /api/register": () => jsonResponse({ userId: "u1", deviceToken: "tok-1", name: "דני" }, 201),
    });
    renderWithProviders(<RegistrationForm />);
    submit("  דני ");
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/vote"));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("tok-1");
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ name: "דני" });
  });

  it("shows the Hebrew duplicate-name message and keeps the typed name", async () => {
    mockFetch({ "POST /api/register": () => jsonResponse({ error: "השם תפוס, נסה 'דני כ.'" }, 409) });
    renderWithProviders(<RegistrationForm />);
    submit("דני");
    expect(await screen.findByText("השם תפוס, נסה 'דני כ.'")).toBeTruthy();
    expect((screen.getByLabelText("השם שלך") as HTMLInputElement).value).toBe("דני");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows a network error and keeps the typed name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    renderWithProviders(<RegistrationForm />);
    submit("רותם");
    expect(await screen.findByText(/בעיית תקשורת/)).toBeTruthy();
    expect((screen.getByLabelText("השם שלך") as HTMLInputElement).value).toBe("רותם");
  });

  it("validates the name length before calling the server", async () => {
    const fetch = mockFetch({});
    renderWithProviders(<RegistrationForm />);
    submit("א");
    expect(await screen.findByText(/2–30 תווים/, { selector: "[role=alert]" })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a returning device straight to its ballot", async () => {
    signIn("tok-2");
    const fetch = mockFetch({
      "GET /api/me": ({ headers }) => {
        expect(headers["x-device-token"]).toBe("tok-2");
        return jsonResponse({ user: { id: "u2", name: "יעל" }, vote: null });
      },
    });
    renderWithProviders(<RegistrationForm />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/vote"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("forgets an invalid stored token and shows the form", async () => {
    signIn("stale");
    mockFetch({ "GET /api/me": () => jsonResponse({ error: "לא מזוהה" }, 401) });
    renderWithProviders(<RegistrationForm />);
    await waitFor(() => expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull());
    expect(screen.getByLabelText("השם שלך")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
