import { describe, expect, test } from "bun:test";
import { PermissionFlags } from "@/permission/permissions";
import type { AuditEntry } from "@/audit/audit-kind";
import PermissionsKind from "./permissions.kind";

function entry(subjectId: string, oldValue: unknown, newValue: unknown): AuditEntry {
  return {
    id: 1,
    kind: "permissions",
    subjectId,
    actorId: "u",
    oldValue,
    newValue,
    createdAt: new Date(),
  } as AuditEntry;
}

describe("permissions kind", () => {
  const kind = new PermissionsKind();

  test("describes a first-time grant and an inheritance change", async () => {
    const flags = String(PermissionFlags.LEVELS_COMMAND);
    expect(await kind.summary(entry("r1", null, { flags, parentRoleId: null }))).toBe(
      "<@&r1>: *none* → Levels Command"
    );
    expect(
      await kind.summary(entry("r1", { flags: "0", parentRoleId: null }, { flags: "0", parentRoleId: "r2" }))
    ).toBe("<@&r1>: no permissions → no permissions (inherits <@&r2>)");
  });

  test("shows the entry number so it can be reverted", async () => {
    expect(await kind.describe(entry("r1", null, { flags: "0", parentRoleId: null }))).toContain("#1");
  });

  test("reverting needs the permissions flag", () => {
    expect(kind.revertFlags).toBe(PermissionFlags.PERMISSIONS_COMMAND);
  });
});
