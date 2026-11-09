import { describe, expect, test } from "bun:test";
import type { GuildAuditLogSchema } from "../db/schemas/guild-audit-log";
import { PermissionFlags } from "../permission/permissions";
import SettingsManager from "../settings/index";
import SettingsModule from "../settings/settings-module";
import { AUDIT_KINDS } from "./kinds";

interface DemoData {
  channelId: string | null;
  enabled: boolean;
  rewards: Record<string, { roleId: string | null }>;
}

SettingsManager.register(
  new SettingsModule<DemoData>({
    id: "demo",
    displayName: "Demo",
    featureId: null,
    defaults: { channelId: null, enabled: false, rewards: {} },
    descriptors: [
      { key: "channelId", label: "Channel", type: "channel", default: null },
      { key: "enabled", label: "Enabled", type: "boolean", default: false },
      {
        key: "rewards",
        label: "Rewards",
        type: "map",
        default: {},
        entry: {
          type: "group",
          label: "Reward",
          default: { roleId: null },
          fields: [{ key: "roleId", type: "role", label: "Role", default: null }],
        },
      },
    ],
  })
);

function entry(kind: string, key: string, oldValue: unknown, newValue: unknown): GuildAuditLogSchema {
  return {
    id: 1,
    guildId: "g",
    actorId: "u",
    kind,
    key,
    oldValue,
    newValue,
    createdAt: new Date(),
  } as GuildAuditLogSchema;
}

describe("settings audit kind", () => {
  const kind = AUDIT_KINDS.settings!;

  test("formats values by descriptor type", () => {
    expect(kind.describe(entry("settings", "demo.channelId", null, "123"))).toBe(
      "`demo.channelId`: *default* → <#123>"
    );
    expect(kind.describe(entry("settings", "demo.enabled", false, true))).toBe("`demo.enabled`: Off → On");
  });

  test("resolves a map entry's field through the entry descriptor", () => {
    expect(kind.describe(entry("settings", "demo.rewards.5.roleId", null, "9"))).toBe(
      "`demo.rewards.5.roleId`: *default* → <@&9>"
    );
  });

  test("falls back to code formatting for an unregistered module", () => {
    expect(kind.describe(entry("settings", "not-a-module.title", "a", "b"))).toBe(
      "`not-a-module.title`: `a` → `b`"
    );
  });

  test("reverting needs the settings flag", () => {
    expect(kind.revertFlags).toBe(PermissionFlags.SETTINGS_COMMAND);
  });
});

describe("permissions audit kind", () => {
  const kind = AUDIT_KINDS.permissions!;

  test("describes a first-time grant and an inheritance change", () => {
    const flags = String(PermissionFlags.LEVELS_COMMAND);
    expect(kind.describe(entry("permissions", "r1", null, { flags, parentRoleId: null }))).toBe(
      "<@&r1>: *none* → Levels Command"
    );
    expect(
      kind.describe(
        entry("permissions", "r1", { flags: "0", parentRoleId: null }, { flags: "0", parentRoleId: "r2" })
      )
    ).toBe("<@&r1>: no permissions → no permissions (inherits <@&r2>)");
  });

  test("reverting needs the permissions flag", () => {
    expect(kind.revertFlags).toBe(PermissionFlags.PERMISSIONS_COMMAND);
  });
});
