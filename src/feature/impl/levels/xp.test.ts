import { describe, expect, test } from "bun:test";
import { levelForXp, progressToNext, xpForLevel } from "./xp";

describe("xp curve", () => {
  test("new users start at level 1 with 0 XP", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
  });

  test("levelForXp inverts xpForLevel at every boundary", () => {
    for (let level = 1; level <= 500; level++) {
      const threshold = xpForLevel(level);
      expect(levelForXp(threshold)).toBe(level);
      expect(levelForXp(xpForLevel(level + 1) - 1)).toBe(level);
    }
  });

  test("per-level gaps keep growing", () => {
    for (let level = 2; level <= 200; level++) {
      expect(xpForLevel(level + 1) - xpForLevel(level)).toBeGreaterThan(
        xpForLevel(level) - xpForLevel(level - 1)
      );
    }
  });

  test("progressToNext spans 0 at a threshold to just under 1", () => {
    expect(progressToNext(xpForLevel(10))).toBe(0);
    expect(progressToNext(xpForLevel(11) - 1)).toBeLessThan(1);
    expect(progressToNext(xpForLevel(11) - 1)).toBeGreaterThan(0.99);
  });
});
