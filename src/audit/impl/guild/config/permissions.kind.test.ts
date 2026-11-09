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
    const flags = String(PermissionFlags.LEVELS_ADMIN);
    const granted = await kind.summary(entry("r1", null, { flags, parentRoleId: null }));
    expect(granted).toContain("<@&r1>");
    expect(granted).toContain("Levels Admin");
    const inherited = await kind.summary(
      entry("r1", { flags: "0", parentRoleId: null }, { flags: "0", parentRoleId: "r2" })
    );
    expect(inherited).toContain("<@&r2>");
  });

  test("shows the entry number so it can be reverted", async () => {
    expect(await kind.describe(entry("r1", null, { flags: "0", parentRoleId: null }))).toContain("#1");
  });

  test("reverting needs the permissions flag", () => {
    expect(kind.revertFlags).toBe(PermissionFlags.MANAGE_PERMISSIONS);
  });
});
