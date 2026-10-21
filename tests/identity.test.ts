import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/register/route";
import { GET as me } from "@/app/api/me/route";
import { clientIp } from "@/lib/rate-limit";
import { hashDeviceToken } from "@/lib/auth";
import { prisma, resetDb } from "./helpers/db";
import { registerUser, request } from "./helpers/api";

beforeEach(resetDb);
afterEach(() => {
  delete process.env.TRUST_PROXY_HEADER;
});

const post = (name: unknown, ip = "10.0.0.1") =>
  register(request("/api/register", { method: "POST", body: { name }, headers: { "x-forwarded-for": ip } }));

describe("POST /api/register", () => {
  it("registers a valid name and returns an unpredictable token", async () => {
    const res = await post("  דני   כהן ");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBeTruthy();
    expect(body.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: body.userId } });
    expect(user.name).toBe("דני כהן");
    expect(user.deviceToken).toBe(hashDeviceToken(body.deviceToken));
    expect(user.deviceToken).not.toBe(body.deviceToken);
  });

  it("rejects a differently spaced/cased duplicate with a Hebrew suggestion", async () => {
    expect((await post("Dani Cohen")).status).toBe(201);
    const res = await post("  dani   COHEN ");
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("השם תפוס, נסה 'dani COHEN כ.'");
  });

  it("only one of several concurrent registrations of a name wins", async () => {
    const results = await Promise.all(["Noa", "noa", " NOA", "noa "].map((n, i) => post(n, `10.0.1.${i}`)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    expect(await prisma.user.count()).toBe(1);
  });

  it("rejects invalid names and malformed bodies", async () => {
    expect((await post("א")).status).toBe(400);
    expect((await post("א".repeat(31))).status).toBe(400);
    expect((await post(12)).status).toBe(400);
    const res = await register(request("/api/register", { method: "POST", body: "{nope" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 on the eleventh attempt per minute from one IP", async () => {
    for (let i = 0; i < 10; i++) expect((await post(`user ${i}`, "10.9.9.9")).status).toBe(201);
    const res = await post("user 10", "10.9.9.9");
    expect(res.status).toBe(429);
    expect((await post("other ip", "10.9.9.8")).status).toBe(201);
  });
});

describe("client IP", () => {
  it("uses the last x-forwarded-for hop by default", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("uses the trusted proxy header when configured", () => {
    process.env.TRUST_PROXY_HEADER = "cf-connecting-ip";
    expect(clientIp(new Headers({ "cf-connecting-ip": "3.3.3.3", "x-forwarded-for": "4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers({ "x-forwarded-for": "4.4.4.4" }))).toBe("4.4.4.4");
  });
});

describe("GET /api/me", () => {
  it("returns only the token owner and their vote", async () => {
    const { deviceToken, userId } = await registerUser("רותם");
    await registerUser("יעל", "10.0.0.2");
    const res = await me(request("/api/me", { headers: { "x-device-token": deviceToken } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: userId, name: "רותם" }, vote: null });
  });

  it("returns 401 for missing or unknown tokens", async () => {
    expect((await me(request("/api/me"))).status).toBe(401);
    expect((await me(request("/api/me", { headers: { "x-device-token": "bogus" } }))).status).toBe(401);
  });
});
