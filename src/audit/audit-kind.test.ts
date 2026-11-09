import { describe, expect, test } from "bun:test";
import type Event from "../event/event";
import { diffFields, type AuditEntry } from "./audit-kind";
import type GuildEventKind from "./guild-event-kind";
import {
  GUILD_AUDIT_GROUPS,
  GUILD_AUDIT_KINDS,
  GUILD_KIND_BY_ID,
  USER_AUDIT_GROUPS,
  USER_KIND_BY_ID,
} from "./kinds";

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
  } as AuditEntry;
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

  test("a change reported once per mutual guild is recorded once", () => {
    const kind = USER_KIND_BY_ID.username!;
    const event = {
      oldUser: { username: "first", partial: false },
      newUser: { id: "2", username: "second", partial: false },
    } as never;
    expect(kind.draft(event)).not.toBeNull();
    expect(kind.draft(event)).toBeNull();
  });

  test("describes a row", async () => {
    const row = { oldValue: "a", newValue: "b", actorId: null, createdAt: at } as AuditEntry;
    expect(await USER_KIND_BY_ID.username!.describe(row)).toBe(
      `**Username changed** · ${when}\n> \`a\` → \`b\``
    );
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
    const text = await GUILD_KIND_BY_ID.channel_create!.describe(row);
    expect(text).toContain("`new`");
    expect(text).not.toContain("null");
  });

  test("a permission change names the permissions", async () => {
    const row = guildRow("role_update", { permissions: "0" }, { permissions: "8" });
    expect(await GUILD_KIND_BY_ID.role_update!.describe(row)).toContain("Administrator");
  });

  test("roles lists additions and removals", async () => {
    const row = guildRow("roles", null, { added: ["1"], removed: ["2"] });
    const text = await GUILD_KIND_BY_ID.roles!.describe(row);
    expect(text).toContain("<@&1>");
    expect(text).toContain("<@&2>");
  });

  test("a single role change is titled by direction", async () => {
    const added = await GUILD_KIND_BY_ID.roles!.describe(
      guildRow("roles", null, { added: ["1"], removed: [] })
    );
    expect(added).toMatch(/added/i);
    expect(added).not.toMatch(/removed/i);
    const removed = await GUILD_KIND_BY_ID.roles!.describe(
      guildRow("roles", null, { added: [], removed: ["1", "2"] })
    );
    expect(removed).toMatch(/removed/i);
    expect(removed).not.toMatch(/added/i);
  });

  test("an unset side reads differently from a changed one", async () => {
    const set = await GUILD_KIND_BY_ID.nickname!.describe(guildRow("nickname", null, "Bob"));
    const cleared = await GUILD_KIND_BY_ID.nickname!.describe(guildRow("nickname", "Bob", null));
    expect(set).toContain("Bob");
    expect(cleared).toContain("Bob");
    expect(set).not.toEqual(cleared);
  });

  test("timeout and boost put the direction in the title", async () => {
    const started = await GUILD_KIND_BY_ID.timeout!.describe(
      guildRow("timeout", null, "2026-01-01T00:00:00Z")
    );
    expect(started).toContain("<t:1767225600:f>");
    const removed = await GUILD_KIND_BY_ID.timeout!.describe(
      guildRow("timeout", "2026-01-01T00:00:00Z", null)
    );
    expect(removed).not.toContain("<t:1767225600:f>");
    expect(await GUILD_KIND_BY_ID.boost!.describe(guildRow("boost", false, true))).toContain("<@42>");
  });

  test("moving a channel names the category and skips a self-made change's actor", async () => {
    expect(
      await GUILD_KIND_BY_ID.channel_update!.describe(
        guildRow("channel_update", { parentId: "5" }, { parentId: null })
      )
    ).toMatch(/categor/i);
    expect(await GUILD_KIND_BY_ID.nickname!.describe(guildRow("nickname", "a", "b", "42"))).not.toContain(
      "by <@"
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
    expect((GUILD_KIND_BY_ID.channel_update as GuildEventKind<Event>).draft(event)).toBeNull();
  });

  test("every kind id is unique", () => {
    const ids = GUILD_AUDIT_KINDS.map(kind => kind.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("audit groups", () => {
  test("every group holds only real kinds and the filters fit Discord's choice limit", () => {
    for (const groups of [GUILD_AUDIT_GROUPS, USER_AUDIT_GROUPS]) {
      expect(groups.length).toBeLessThanOrEqual(25);
      for (const { kindIds } of groups) {
        expect(kindIds.length).toBeGreaterThan(0);
        for (const id of kindIds) {
          expect(id in GUILD_KIND_BY_ID || id in USER_KIND_BY_ID).toBe(true);
        }
      }
    }
  });

  test("a thing's create, update and delete share one group", () => {
    expect(GUILD_AUDIT_GROUPS.find(group => group.id === "channel")?.kindIds).toEqual([
      "channel_create",
      "channel_update",
      "channel_delete",
    ]);
  });
});
