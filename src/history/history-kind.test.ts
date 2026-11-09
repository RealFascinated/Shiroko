import { describe, expect, test } from "bun:test";
import { diffFields, formatChange, type HistoryEntry } from "./history-kind";
import { GUILD_KIND_BY_ID, USER_KIND_BY_ID } from "./kinds";

const at = new Date("2026-01-01T00:00:00Z");

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
});

describe("formatChange", () => {
  test("renders null as none", () => {
    expect(formatChange({ oldValue: null, newValue: "x" })).toBe("*none* → `x`");
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

  test("describes a row", async () => {
    const row = { oldValue: "a", newValue: "b" } as HistoryEntry;
    expect(await USER_KIND_BY_ID.username!.describe(row)).toBe("**Username**: `a` → `b`");
  });
});

describe("guild kinds", () => {
  test("roles lists additions and removals", async () => {
    const row = guildRow("roles", null, { added: ["1"], removed: ["2"] });
    expect(await GUILD_KIND_BY_ID.roles!.describe(row)).toBe("**Roles** <@42>: +<@&1> -<@&2>");
  });

  test("a leave with an audit actor reads as a kick", async () => {
    expect(await GUILD_KIND_BY_ID.member_leave!.describe(guildRow("member_leave", null, null, "7"))).toBe(
      "**Kicked** <@42>"
    );
    expect(await GUILD_KIND_BY_ID.member_leave!.describe(guildRow("member_leave", null, null))).toBe(
      "**Left** <@42>"
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
