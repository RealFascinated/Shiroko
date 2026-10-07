import { describe, expect, test } from "bun:test";
import { ChannelType, type NonThreadGuildBasedChannel, type PermissionOverwrites } from "discord.js";
import { channelUpdateLines, describeChannelChanges } from "./channel-log";

const CHANNEL_ID = "200000000000000001";
const ROLE_ID = "100000000000000001";
const ROLE_MENTION = `<@&${ROLE_ID}>`;
const OTHER_ROLE_ID = "100000000000000002";
const OTHER_ROLE_MENTION = `<@&${OTHER_ROLE_ID}>`;

function overwrite(allow: string[], deny: string[]): PermissionOverwrites {
  return {
    allow: { toArray: () => allow },
    deny: { toArray: () => deny },
  } as unknown as PermissionOverwrites;
}

function channel(overwrites: Array<[string, PermissionOverwrites]>): NonThreadGuildBasedChannel {
  return {
    id: CHANNEL_ID,
    name: "ticket-2230",
    type: ChannelType.GuildText,
    parent: null,
    topic: null,
    rateLimitPerUser: 0,
    nsfw: false,
    permissionOverwrites: { cache: new Map(overwrites) },
    guild: {
      roles: {
        cache: new Map([
          [ROLE_ID, { toString: () => ROLE_MENTION }],
          [OTHER_ROLE_ID, { toString: () => OTHER_ROLE_MENTION }],
        ]),
      },
      members: { cache: new Map() },
    },
  } as unknown as NonThreadGuildBasedChannel;
}

describe("describeChannelChanges", () => {
  test("reports nothing for an unchanged channel", () => {
    const before = channel([[ROLE_ID, overwrite(["ViewChannel"], [])]]);
    const after = channel([[ROLE_ID, overwrite(["ViewChannel"], [])]]);
    expect(describeChannelChanges(before, after)).toEqual({ fields: [], permissions: [] });
  });

  test("names a renamed channel", () => {
    const before = channel([]);
    const after = { ...channel([]), name: "ticket-2231" } as NonThreadGuildBasedChannel;
    expect(describeChannelChanges(before, after)).toEqual({
      fields: [
        {
          summary: "Name changed",
          detail: "`ticket-2230` → `ticket-2231`",
          line: "**➜** Name: `ticket-2230` → `ticket-2231`",
        },
      ],
      permissions: [],
    });
  });

  test("names a permission the overwrite no longer sets", () => {
    const before = channel([[ROLE_ID, overwrite(["ViewChannel"], [])]]);
    const after = channel([[ROLE_ID, overwrite([], [])]]);
    expect(describeChannelChanges(before, after)).toEqual({
      fields: [],
      permissions: [
        {
          summary: "Permissions changed",
          detail: `${ROLE_MENTION} ⬤ View Channel`,
          line: `**➜** ${ROLE_MENTION} ⬤ View Channel`,
        },
      ],
    });
  });

  test("groups each changed permission under the state it moved to", () => {
    const before = channel([[ROLE_ID, overwrite(["ViewChannel"], ["SendMessages"])]]);
    const after = channel([[ROLE_ID, overwrite(["SendMessages"], [])]]);
    expect(describeChannelChanges(before, after)).toEqual({
      fields: [],
      permissions: [
        {
          summary: "Permissions changed",
          detail: `${ROLE_MENTION} ✓ Send Messages ⬤ View Channel`,
          line: `**➜** ${ROLE_MENTION} ✓ Send Messages ⬤ View Channel`,
        },
      ],
    });
  });
});

describe("channelUpdateLines", () => {
  test("focuses a single change on the field that changed", () => {
    const before = channel([]);
    const after = { ...channel([]), name: "ticket-2231" } as NonThreadGuildBasedChannel;
    expect(channelUpdateLines(after, describeChannelChanges(before, after))).toEqual([
      `Name changed for <#${CHANNEL_ID}>.`,
      "",
      "`ticket-2230` → `ticket-2231`",
    ]);
  });

  test("names the field a single non-name change touched", () => {
    const before = channel([]);
    const after = { ...channel([]), topic: "Help" } as NonThreadGuildBasedChannel;
    expect(channelUpdateLines(after, describeChannelChanges(before, after))).toEqual([
      `Topic changed for <#${CHANNEL_ID}>.`,
      "",
      "None → Help",
    ]);
  });

  test("names the permissions a single overwrite change touched", () => {
    const before = channel([[ROLE_ID, overwrite(["ViewChannel"], [])]]);
    const after = channel([[ROLE_ID, overwrite([], [])]]);
    expect(channelUpdateLines(after, describeChannelChanges(before, after))).toEqual([
      `Permissions changed for <#${CHANNEL_ID}>.`,
      "",
      `${ROLE_MENTION} ⬤ View Channel`,
    ]);
  });

  test("lists every field change when only fields changed", () => {
    const before = channel([]);
    const after = { ...channel([]), name: "ticket-2231", topic: "Help" } as NonThreadGuildBasedChannel;
    expect(channelUpdateLines(after, describeChannelChanges(before, after))).toEqual([
      `<#${CHANNEL_ID}> was updated.`,
      "",
      "**➜** Name: `ticket-2230` → `ticket-2231`",
      "**➜** Topic: None → Help",
    ]);
  });

  test("trails permission changes under a header when fields also changed", () => {
    const before = channel([[ROLE_ID, overwrite(["ViewChannel"], [])]]);
    const after = {
      ...channel([[ROLE_ID, overwrite([], [])]]),
      name: "ticket-2231",
    } as NonThreadGuildBasedChannel;
    expect(channelUpdateLines(after, describeChannelChanges(before, after))).toEqual([
      `<#${CHANNEL_ID}> was updated.`,
      "",
      "**➜** Name: `ticket-2230` → `ticket-2231`",
      "**➜** Permission Changes:",
      `**➜** ${ROLE_MENTION} ⬤ View Channel`,
    ]);
  });

  test("omits the header when only permissions changed", () => {
    const before = channel([
      [ROLE_ID, overwrite(["ViewChannel"], [])],
      [OTHER_ROLE_ID, overwrite(["ViewChannel"], [])],
    ]);
    const after = channel([
      [ROLE_ID, overwrite([], [])],
      [OTHER_ROLE_ID, overwrite([], [])],
    ]);
    expect(channelUpdateLines(after, describeChannelChanges(before, after))).toEqual([
      `<#${CHANNEL_ID}> was updated.`,
      "",
      `**➜** ${ROLE_MENTION} ⬤ View Channel`,
      `**➜** ${OTHER_ROLE_MENTION} ⬤ View Channel`,
    ]);
  });

  test("yields nothing for an unchanged channel", () => {
    const before = channel([]);
    expect(channelUpdateLines(before, describeChannelChanges(before, channel([])))).toEqual([]);
  });
});
