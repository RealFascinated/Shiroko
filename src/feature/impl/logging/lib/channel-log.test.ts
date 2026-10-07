import { describe, expect, test } from "bun:test";
import { ChannelType, type NonThreadGuildBasedChannel, type PermissionOverwrites } from "discord.js";
import { describeChannelChanges } from "./channel-log";

const ROLE_ID = "100000000000000001";
const ROLE_MENTION = `<@&${ROLE_ID}>`;

function overwrite(allow: string[], deny: string[]): PermissionOverwrites {
  return {
    allow: { toArray: () => allow },
    deny: { toArray: () => deny },
  } as unknown as PermissionOverwrites;
}

function channel(overwrites: Array<[string, PermissionOverwrites]>): NonThreadGuildBasedChannel {
  return {
    name: "ticket-2230",
    type: ChannelType.GuildText,
    parent: null,
    topic: null,
    rateLimitPerUser: 0,
    nsfw: false,
    permissionOverwrites: { cache: new Map(overwrites) },
    guild: {
      roles: { cache: new Map([[ROLE_ID, { toString: () => ROLE_MENTION }]]) },
      members: { cache: new Map() },
    },
  } as unknown as NonThreadGuildBasedChannel;
}

describe("describeChannelChanges", () => {
  test("reports nothing for an unchanged channel", () => {
    const before = channel([[ROLE_ID, overwrite(["ViewChannel"], [])]]);
    const after = channel([[ROLE_ID, overwrite(["ViewChannel"], [])]]);
    expect(describeChannelChanges(before, after)).toEqual([]);
  });

  test("names a permission the overwrite no longer sets", () => {
    const before = channel([[ROLE_ID, overwrite(["ViewChannel"], [])]]);
    const after = channel([[ROLE_ID, overwrite([], [])]]);
    expect(describeChannelChanges(before, after)).toEqual([
      `**➜** Updated permissions for ${ROLE_MENTION} ⬤ View Channel`,
    ]);
  });

  test("groups each changed permission under the state it moved to", () => {
    const before = channel([[ROLE_ID, overwrite(["ViewChannel"], ["SendMessages"])]]);
    const after = channel([[ROLE_ID, overwrite(["SendMessages"], [])]]);
    expect(describeChannelChanges(before, after)).toEqual([
      `**➜** Updated permissions for ${ROLE_MENTION} ✓ Send Messages ⬤ View Channel`,
    ]);
  });
});
