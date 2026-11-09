import type GlobalUser from "@/user/global-user";
import { describe, expect, test } from "bun:test";
import type { Guild, User } from "discord.js";
import { placeholders, userPlaceholders } from "./index";

function globalUser(tag = "shiroko"): GlobalUser {
  const user = {
    id: "7",
    displayName: "Shiro",
    username: "shiroko",
    tag,
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
  test("every key is unique and described", () => {
    for (const executor of [placeholders, userPlaceholders]) {
      const keys = executor.placeholders.map(placeholder => placeholder.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every(key => key.length > 0)).toBe(true);
      expect(executor.placeholders.every(placeholder => placeholder.description.length > 0)).toBe(true);
    }
  });

  test("the guild executor holds every user token", () => {
    const userKeys = userPlaceholders.placeholders.map(placeholder => placeholder.key);
    const guildKeys = placeholders.placeholders.map(placeholder => placeholder.key);
    expect(userKeys.every(key => guildKeys.includes(key))).toBe(true);
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

  test("the username token falls back to the tag when the user has one", async () => {
    expect(
      await userPlaceholders.replace({ globalUser: globalUser("shiroko#1234") }, "{user_username}")
    ).toBe("shiroko#1234");
  });

  test("the user executor leaves guild tokens verbatim", async () => {
    expect(await userPlaceholders.replace({ globalUser: globalUser() }, "{guild_name}")).toBe("{guild_name}");
  });
});
