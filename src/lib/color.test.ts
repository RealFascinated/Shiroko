import { describe, expect, test } from "bun:test";
import { formatColor, parseColor } from "./color";

describe("parseColor", () => {
  test("parses a leading-hash hex colour", () => {
    expect(parseColor("#9b59b6")).toBe(0x9b59b6);
  });

  test("parses a bare hex colour", () => {
    expect(parseColor("9b59b6")).toBe(0x9b59b6);
  });

  test("parses black and white", () => {
    expect(parseColor("#000000")).toBe(0);
    expect(parseColor("#ffffff")).toBe(0xffffff);
  });

  test("is case insensitive and tolerates surrounding whitespace", () => {
    expect(parseColor("  #9B59B6 ")).toBe(0x9b59b6);
  });

  test("rejects malformed input", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("#fff")).toBeNull();
    expect(parseColor("#gggggg")).toBeNull();
    expect(parseColor("#9b59b6ff")).toBeNull();
    expect(parseColor("rgb(1,2,3)")).toBeNull();
  });
});

describe("formatColor", () => {
  test("renders a padded lowercase hex colour", () => {
    expect(formatColor(0x9b59b6)).toBe("#9b59b6");
    expect(formatColor(0)).toBe("#000000");
    expect(formatColor(0xffffff)).toBe("#ffffff");
  });

  test("round-trips through parseColor", () => {
    expect(parseColor(formatColor(0x0a0b0c))).toBe(0x0a0b0c);
  });
});
