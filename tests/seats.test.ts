import { describe, expect, it } from "vitest";
import { adjustSeats, defaultSeatMap, parseSeats, remainingSeats, restoreSeatMap, seatCap, sumSeats, zeroSeats } from "@/lib/seats";
import { SEED_SEATS } from "./fixtures/prd";

const parties = Object.keys(SEED_SEATS).map((id) => ({ id, withdrawn: id === "blue-white", defaultSeats: SEED_SEATS[id as keyof typeof SEED_SEATS] }));

describe("seat arithmetic", () => {
  it("sums, remaining and caps", () => {
    const seats = { ...SEED_SEATS, likud: 15 };
    expect(sumSeats(seats)).toBe(112);
    expect(remainingSeats(seats)).toBe(8);
    expect(seatCap(seats, "likud")).toBe(23);
    expect(seatCap(seats, "amcha")).toBe(8);
  });

  it("clamps at the current value plus remaining seats", () => {
    const seats = { ...SEED_SEATS, likud: 15 };
    expect(adjustSeats(seats, "likud", 120, 4).likud).toBe(23);
    expect(adjustSeats(SEED_SEATS, "likud", 60, 4)).toBe(SEED_SEATS);
    expect(adjustSeats(seats, "likud", -5, 4).likud).toBe(0);
  });

  it("jumps from 0 to the threshold and back", () => {
    const seats = { ...SEED_SEATS, likud: 15 };
    expect(adjustSeats(seats, "amcha", 1, 4).amcha).toBe(4);
    expect(adjustSeats(seats, "amcha", 3, 4).amcha).toBe(4);
    const four = { ...seats, amcha: 4 };
    expect(adjustSeats(four, "amcha", 3, 4).amcha).toBe(0);
    expect(adjustSeats({ ...four, amcha: 7 }, "amcha", 2, 4).amcha).toBe(0);
  });

  it("stays at 0 when fewer than threshold seats remain", () => {
    const seats = { ...SEED_SEATS, likud: 21 };
    expect(adjustSeats(seats, "amcha", 1, 4)).toBe(seats);
  });

  it("moves one seat at a time when the threshold is disabled", () => {
    const seats = { ...SEED_SEATS, likud: 21 };
    expect(adjustSeats(seats, "amcha", 1, 0).amcha).toBe(1);
  });

  it("builds default, zero and restored maps", () => {
    expect(defaultSeatMap(parties)).toEqual(SEED_SEATS);
    expect(sumSeats(zeroSeats(parties))).toBe(0);
    expect(restoreSeatMap({ likud: 60, gone: 10, "blue-white": 4, shas: 2.5 }, parties)).toMatchObject({
      likud: 60,
      "blue-white": 0,
      shas: 0,
      yashar: 0,
    });
    expect(restoreSeatMap({}, parties)).not.toHaveProperty("gone");
  });

  it("parses stored JSON defensively", () => {
    expect(parseSeats('{"a":4,"b":"x"}')).toEqual({ a: 4 });
    expect(parseSeats("not json")).toEqual({});
    expect(parseSeats("[1]")).toEqual({});
  });
});
