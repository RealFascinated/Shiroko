import { describe, expect, test } from "bun:test";
import Permissions, { flagLabels, hasFlags, PermissionFlags } from "./permissions";

const FEATURE = PermissionFlags.FEATURE_COMMAND;
const PERMISSIONS = PermissionFlags.PERMISSIONS_COMMAND;

function config(
  entries: Array<[string, bigint, string | null]>
): Map<string, { own: bigint; parent: string | null }> {
  return new Map(entries.map(([roleId, own, parent]) => [roleId, { own, parent }]));
}

describe("flagLabels", () => {
  test("decodes known flags to display names", () => {
    expect(flagLabels(FEATURE)).toEqual(["Feature Command"]);
    expect(flagLabels(FEATURE | PERMISSIONS)).toEqual(["Feature Command", "Permissions Command"]);
  });

  test("empty flags decode to nothing", () => {
    expect(flagLabels(0n)).toEqual([]);
  });
});

describe("hasFlags", () => {
  test("requires all requested flags", () => {
    expect(hasFlags(FEATURE | PERMISSIONS, FEATURE)).toBe(true);
    expect(hasFlags(FEATURE, FEATURE | PERMISSIONS)).toBe(false);
    expect(hasFlags(FEATURE, 0n)).toBe(true);
  });
});

describe("resolveEffective", () => {
  test("no config → no flags", () => {
    expect(Permissions.resolveEffective(new Map(), "roleA")).toBe(0n);
  });

  test("own flags without parent", () => {
    const configs = config([["roleA", FEATURE, null]]);
    expect(Permissions.resolveEffective(configs, "roleA")).toBe(FEATURE);
  });

  test("additive inheritance: child own flags OR parent's", () => {
    const configs = config([
      ["admin", FEATURE | PERMISSIONS, null],
      ["staff", PERMISSIONS, "admin"],
    ]);
    expect(Permissions.resolveEffective(configs, "staff")).toBe(FEATURE | PERMISSIONS);
  });

  test("dangling parent resolves to no inheritance", () => {
    const configs = config([["child", FEATURE, "missing"]]);
    expect(Permissions.resolveEffective(configs, "child")).toBe(FEATURE);
  });

  test("cycle breaks without infinite loop", () => {
    const configs = config([
      ["a", FEATURE, "b"],
      ["b", PERMISSIONS, "a"],
    ]);
    // a's effective = a own | b own (cycle cut before repeating a)
    expect(Permissions.resolveEffective(configs, "a")).toBe(FEATURE | PERMISSIONS);
  });

  test("deep chain unions every ancestor's own flags", () => {
    const configs = config([
      ["root", FEATURE, null],
      ["mid", PERMISSIONS, "root"],
      ["leaf", 0n, "mid"],
    ]);
    expect(Permissions.resolveEffective(configs, "leaf")).toBe(FEATURE | PERMISSIONS);
  });

  test("member ignoring a role ignores its flags", () => {
    const configs = config([["admin", FEATURE, null]]);
    expect(Permissions.resolveEffective(configs, "someone-else")).toBe(0n);
  });
});

describe("assertNoCycle (via setParent)", () => {
  test("rejects self-parent", async () => {
    await expect(Permissions.setParent("g", "a", "a")).rejects.toThrow(/own parent/);
  });
});
