import { describe, expect, test } from "bun:test";
import { diffFields, type HistoryEntry } from "./history-kind";
import { GUILD_KIND_BY_ID, USER_KIND_BY_ID } from "./kinds";

const at = new Date("2026-01-01T00:00:00Z");
const when = "<t:1767225600:R>";

function guildRow(kind: string, oldValue: unknown, newValue: unknown, actorId: string | null = null) {
  return {
    id: 1,
    guildId: "g",
    kind,
    subjectId: "42",
    actorId,
    oldValue,
    newValue,
    createdAt: at,
  } as HistoryEntry;
}

describe("diffFields", () => {
  test("keeps only the fields that changed", () => {
    expect(diffFields({ name: "a", nsfw: false }, { name: "b", nsfw: false })).toEqual({
      oldValue: { name: "a" },
      newValue: { name: "b" },
    });
  });

  test("is null when nothing changed", () => {
    expect(diffFields({ name: "a" }, { name: "a" })).toBeNull();
  });

  test("an empty string and null are the same unset value", () => {
    expect(diffFields({ topic: null }, { topic: "" })).toBeNull();
    expect(diffFields({ topic: null, name: "a" }, { topic: "", name: "b" })).toEqual({
      oldValue: { name: "a" },
      newValue: { name: "b" },
    });
  });
});

describe("user kinds", () => {
  test("records a change once even though the bridge posts it per guild", () => {
    const kind = USER_KIND_BY_ID.username!;
    const oldUser = { username: "old", partial: false };
    const newUser = { id: "1", username: "new", partial: false };
    const event = { oldUser, newUser } as never;
    expect(kind.draft(event)).toMatchObject({ oldValue: "old", newValue: "new" });
    expect(kind.draft(event)).toBeNull();
  });

  test("records a later change by the same cached user object", () => {
    const kind = USER_KIND_BY_ID.username!;
    const newUser = { id: "2", username: "second", partial: false };
    kind.draft({ oldUser: { username: "first", partial: false }, newUser } as never);
    newUser.username = "third";
    expect(kind.draft({ oldUser: { username: "second", partial: false }, newUser } as never)).toMatchObject({
      oldValue: "second",
      newValue: "third",
    });
  });

  test("describes a row", async () => {
    const row = { oldValue: "a", newValue: "b", actorId: null, createdAt: at } as HistoryEntry;
    expect(await USER_KIND_BY_ID.username!.describe(row)).toBe(`**Username** · ${when}\n> \`a\` → \`b\``);
  });
});

describe("guild kinds", () => {
  test("a channel update lists only what changed, with readable values", async () => {
    const row = guildRow(
      "channel_update",
      { name: "test-bob", slowmode: 0 },
      { name: "test", slowmode: 30 },
      "7"
    );
    expect(await GUILD_KIND_BY_ID.channel_update!.describe(row)).toBe(
      `**Channel updated** <#42> · ${when} · by <@7>\n> **Name**: \`test-bob\` → \`test\`\n> **Slowmode**: Off → 30s`
    );
  });

  test("a snapshot skips unset fields", async () => {
    const row = guildRow("channel_create", null, { name: "new", topic: null, nsfw: false });
    expect(await GUILD_KIND_BY_ID.channel_create!.describe(row)).toBe(
      `**Channel created** <#42> · ${when}\n> **Name**: \`new\`\n> **Age-restricted**: Off`
    );
  });

  test("a permission change names the permissions", async () => {
    const row = guildRow("role_update", { permissions: "0" }, { permissions: "8" });
    expect(await GUILD_KIND_BY_ID.role_update!.describe(row)).toContain("**Permissions**: +Administrator");
  });

  test("roles lists additions and removals", async () => {
    const row = guildRow("roles", null, { added: ["1"], removed: ["2"] });
    expect(await GUILD_KIND_BY_ID.roles!.describe(row)).toBe(
      `**Roles** <@42> · ${when}\n> **Added**: <@&1>\n> **Removed**: <@&2>`
    );
  });

  test("a leave with an audit actor reads as a kick", async () => {
    expect(await GUILD_KIND_BY_ID.member_leave!.describe(guildRow("member_leave", null, null, "7"))).toBe(
      `**Kicked** <@42> · ${when} · by <@7>`
    );
    expect(await GUILD_KIND_BY_ID.member_leave!.describe(guildRow("member_leave", null, null))).toBe(
      `**Left** <@42> · ${when}`
    );
  });

  test("an unchanged update records nothing", () => {
    const channel = { name: "a", type: 0, parentId: null, topic: null, nsfw: false, rateLimitPerUser: 0 };
    const event = { guildData: {}, channelId: "1", oldChannel: channel, newChannel: channel } as never;
    expect(GUILD_KIND_BY_ID.channel_update!.draft(event)).toBeNull();
  });

  test("every kind id is unique", () => {
    expect(Object.keys(GUILD_KIND_BY_ID).length).toBe(26);
  });
});
