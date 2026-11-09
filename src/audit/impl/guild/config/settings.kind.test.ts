import { describe, expect, test } from "bun:test";
import { PermissionFlags } from "@/permission/permissions";
import SettingsManager from "@/settings/index";
import SettingsModule from "@/settings/settings-module";
import type { AuditEntry } from "@/audit/audit-kind";
import SettingsKind from "./settings.kind";

interface DemoData {
  channelId: string | null;
  enabled: boolean;
  color: number;
  rewards: Record<string, { roleId: string | null }>;
}

SettingsManager.register(
  new SettingsModule<DemoData>({
    id: "demo",
    displayName: "Demo",
    featureId: null,
    defaults: { channelId: null, enabled: false, color: 0, rewards: {} },
    descriptors: [
      { key: "channelId", label: "Channel", type: "channel", default: null },
      { key: "enabled", label: "Enabled", type: "boolean", default: false },
      { key: "color", label: "Color", type: "number", default: 0, format: value => `#${value.toString(16)}` },
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
  }),
  { listed: false }
);

function entry(subjectId: string, oldValue: unknown, newValue: unknown): AuditEntry {
  return {
    id: 1,
    kind: "settings",
    subjectId,
    actorId: "u",
    oldValue,
    newValue,
    createdAt: new Date(),
  } as AuditEntry;
}

describe("settings kind", () => {
  const kind = new SettingsKind();

  test("names the setting by its labels and formats values by descriptor type", async () => {
    expect(await kind.summary(entry("demo.channelId", null, "123"))).toBe(
      "**Demo › Channel**: *default* → <#123>"
    );
    expect(await kind.summary(entry("demo.enabled", false, true))).toBe("**Demo › Enabled**: Off → On");
  });

  test("prefers a descriptor's own format", async () => {
    expect(await kind.summary(entry("demo.color", 255, 4096))).toBe("**Demo › Color**: #ff → #1000");
  });

  test("resolves a map entry's field through the entry descriptor", async () => {
    expect(await kind.summary(entry("demo.rewards.5.roleId", null, "9"))).toBe(
      "**Demo › Rewards › 5 › Role**: *default* → <@&9>"
    );
  });

  test("resolves an unlisted module without listing it", () => {
    expect(SettingsManager.get("demo")).toBeDefined();
    expect(SettingsManager.all().some(module => module.id === "demo")).toBe(false);
  });

  test("falls back to code formatting for an unregistered module", async () => {
    expect(await kind.summary(entry("not-a-module.title", "a", "b"))).toBe("`not-a-module.title`: `a` → `b`");
  });

  test("reverting needs the settings flag", () => {
    expect(kind.revertFlags).toBe(PermissionFlags.SETTINGS_COMMAND);
  });
});
