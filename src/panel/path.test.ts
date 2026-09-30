import { describe, expect, test } from "bun:test";
import { getPath, setPath } from "./path";

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

describe("setPath", () => {
  test("writes a nested leaf", () => {
    expect(setPath({ a: { b: 1 } }, "a.b", 2)).toEqual({ a: { b: 2 } });
  });

  test("writes a top-level leaf", () => {
    expect(setPath({ a: 1 }, "a", 9)).toEqual({ a: 9 });
  });

  test("does not mutate the input", () => {
    const original = { a: { b: 1 }, other: "kept" };
    const next = setPath(original, "a.b", 2);
    expect(original.a.b).toBe(1);
    expect(next).not.toBe(original);
    expect(next.a).not.toBe(original.a);
  });

  test("copies only the changed branch", () => {
    const untouched = { deep: { value: 1 } };
    const next = setPath({ a: { b: 1 }, untouched }, "a.b", 2);
    expect(next.untouched).toBe(untouched);
  });

  test("round-trips through getPath", () => {
    const next = setPath({ a: { b: { c: "x" } } }, "a.b.c", "y");
    expect(getPath(next, "a.b.c")).toBe("y");
  });

  test("supports several writes without aliasing", () => {
    let config = { a: { b: 1 }, c: { d: 2 } };
    config = setPath(config, "a.b", 10);
    config = setPath(config, "c.d", 20);
    expect(config).toEqual({ a: { b: 10 }, c: { d: 20 } });
  });
});
