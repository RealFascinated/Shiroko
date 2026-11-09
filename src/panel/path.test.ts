import { describe, expect, test } from "bun:test";
import { getPath } from "./path";

describe("getPath", () => {
  test("reads a nested leaf", () => {
    expect(getPath({ a: { b: { c: 7 } } }, "a.b.c")).toBe(7);
  });

  test("reads a top-level leaf", () => {
    expect(getPath({ a: 1 }, "a")).toBe(1);
  });

  test("returns undefined for a missing branch", () => {
    expect(getPath({ a: {} }, "a.b.c")).toBeUndefined();
    expect(getPath({}, "a")).toBeUndefined();
  });

  test("returns undefined rather than throwing on a non-object", () => {
    expect(getPath({ a: 5 }, "a.b")).toBeUndefined();
    expect(getPath(null, "a")).toBeUndefined();
    expect(getPath({ a: "text" }, "a.length")).toBeUndefined();
  });

  test("reads falsy values faithfully", () => {
    expect(getPath({ a: { b: false } }, "a.b")).toBe(false);
    expect(getPath({ a: { b: null } }, "a.b")).toBeNull();
  });
});
