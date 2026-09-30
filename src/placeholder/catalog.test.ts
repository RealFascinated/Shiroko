import type GlobalUser from "@/user/global-user";
import { describe, expect, test } from "bun:test";
import type { Guild, User } from "discord.js";
import { placeholders, userPlaceholders } from "./index";

function globalUser(): GlobalUser {
  const user = {
    id: "7",
    displayName: "Shiro",
    username: "shiroko",
  } as unknown as User;
  return { id: "7", firstSeen: new Date(0), discordUser: user } as unknown as GlobalUser;
}

function guild(): Guild {
  return {
    name: "Test Guild",
    id: "1",
    ownerId: "2",
    createdAt: new Date(0),
    memberCount: 42,
    channels: { cache: { filter: () => ({ size: 5 }) } },
    roles: { cache: { size: 7 } },
    premiumSubscriptionCount: null,
    premiumTier: 1,
  } as unknown as Guild;
}

describe("placeholder catalogs", () => {
  test("the guild executor holds every user and guild token", () => {
    expect(placeholders.placeholders.map(placeholder => placeholder.key)).toEqual([
      "user_id",
      "user_name",
      "user_username",
      "user_mention",
      "user_first_seen",
      "guild_name",
      "guild_id",
      "guild_owner_mention",
      "guild_created_at",
      "member_count",
      "channel_count",
      "role_count",
      "boost_count",
      "boost_tier",
    ]);
  });

  test("the user executor holds only the guild-agnostic tokens", () => {
    expect(userPlaceholders.placeholders.map(placeholder => placeholder.key)).toEqual([
      "user_id",
      "user_name",
      "user_username",
      "user_mention",
      "user_first_seen",
    ]);
  });

  test("renders a mixed template", async () => {
    const text = await placeholders.replace(
      { globalUser: globalUser(), guild: guild() },
      "{guild_name} ({member_count}) {user_name} <@{user_id}>"
    );
    expect(text).toBe("Test Guild (42) Shiro <@7>");
  });

  test("renders a missing boost count as 0", async () => {
    const text = await placeholders.replace({ globalUser: globalUser(), guild: guild() }, "{boost_count}");
    expect(text).toBe("0");
  });

  test("the user executor resolves user tokens without a guild", async () => {
    expect(await userPlaceholders.replace({ globalUser: globalUser() }, "{user_username}")).toBe("shiroko");
  });

  test("the user executor leaves guild tokens verbatim", async () => {
    expect(await userPlaceholders.replace({ globalUser: globalUser() }, "{guild_name}")).toBe("{guild_name}");
  });
});
