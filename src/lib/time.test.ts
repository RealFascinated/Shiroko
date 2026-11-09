import { describe, expect, test } from "bun:test";
import { TimeUnit, formatDuration, parseDuration } from "./time";

describe("formatDuration", () => {
  test("formats a zero duration", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  test("shows at most two units", () => {
    const ms =
      TimeUnit.toMillis(TimeUnit.Hour, 2) + TimeUnit.toMillis(TimeUnit.Minute, 30) + TimeUnit.toMillis(TimeUnit.Second, 1);
    expect(formatDuration(ms)).toBe("2h, 30m");
  });

  test("keeps milliseconds under a second", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  test("round-trips with parseDuration", () => {
    expect(formatDuration(parseDuration("1h30m")!)).toBe("1h, 30m");
  });
});
