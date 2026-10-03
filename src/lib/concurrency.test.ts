import { describe, expect, test } from "bun:test";
import { forEachLimited } from "./concurrency";

describe("forEachLimited", () => {
  test("visits every item once", async () => {
    const seen: number[] = [];
    await forEachLimited([1, 2, 3, 4, 5], 2, async item => {
      seen.push(item);
    });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  test("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await forEachLimited([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      peak = Math.max(peak, ++inFlight);
      await Bun.sleep(1);
      inFlight--;
    });
    expect(peak).toBe(3);
  });

  test("resolves without visiting anything for an empty list", async () => {
    let calls = 0;
    await forEachLimited([], 4, async () => {
      calls++;
    });
    expect(calls).toBe(0);
  });
});
