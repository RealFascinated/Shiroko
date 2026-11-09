import { describe, expect, test } from "bun:test";
import { afkNotice, cleanReason, MAX_NOTICED, MAX_REASON_LENGTH, welcomeBack } from "./afk-text";

const since = new Date("2026-01-01T00:00:00Z");

describe("cleanReason", () => {
  test("trims, caps the length and turns blank into none", () => {
    expect(cleanReason("  lunch ")).toBe("lunch");
    expect(cleanReason("x".repeat(MAX_REASON_LENGTH + 20))).toHaveLength(MAX_REASON_LENGTH);
    expect(cleanReason("   ")).toBeNull();
    expect(cleanReason(null)).toBeNull();
  });
});

describe("afkNotice", () => {
  test("names the reason and when they left", () => {
    const text = afkNotice([{ name: "Bob", state: { reason: "lunch", since } }]);
    expect(text).toContain("**Bob**");
    expect(text).toContain("lunch");
    expect(text).toContain("<t:1767225600:R>");
  });

  test("leaves out a missing reason rather than printing it", () => {
    const text = afkNotice([{ name: "Bob", state: { reason: null, since } }]);
    expect(text).toContain("**Bob**");
    expect(text).not.toContain("null");
    expect(text).toContain("<t:1767225600:R>");
  });

  test("lists at most the first few people", () => {
    const entries = Array.from({ length: MAX_NOTICED + 2 }, (_, index) => ({
      name: `u${index}`,
      state: { reason: null, since },
    }));
    expect(afkNotice(entries).split("\n")).toHaveLength(MAX_NOTICED);
  });

  test("escapes markdown in a name", () => {
    expect(afkNotice([{ name: "a*b", state: { reason: null, since } }])).toContain("**a\\*b**");
  });
});

describe("welcomeBack", () => {
  test("says how long they were away", () => {
    const now = since.getTime() + (2 * 60 + 30) * 60_000;
    const text = welcomeBack("Bob", { reason: null, since }, now);
    expect(text).toContain("Bob");
    expect(text).toContain("2h, 30m");
  });
});
