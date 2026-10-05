import { describe, expect, test } from "bun:test";
import { mapKeys, mapRecord } from "./utils";

describe("mapKeys", () => {
  test("builds a record from a key list, preserving the key union", () => {
    expect(mapKeys(["a", "b"] as const, key => key.toUpperCase())).toEqual({ a: "A", b: "B" });
  });
});

describe("mapRecord", () => {
  test("maps every key of a lookup table to a value", () => {
    const source = { first: { label: "One" }, second: { label: "Two" } };
    expect(mapRecord(source, (_key, entry) => entry.label)).toEqual({ first: "One", second: "Two" });
  });
});
