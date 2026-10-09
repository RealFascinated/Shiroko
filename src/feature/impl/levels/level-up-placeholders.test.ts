import type GlobalUser from "@/user/global-user";
import { describe, expect, test } from "bun:test";
import type { Guild, User } from "discord.js";
import { levelUpPlaceholders, type LevelUpPlaceholderContext } from "./level-up-placeholders";

/** The resolvers only read ids and names, so stubs carry just those. */
function context(level = 5, xp = 1200): LevelUpPlaceholderContext {
  const user = {
    id: "7",
    displayName: "Shiro",
    username: "shiroko",
    tag: "shiroko",
  } as unknown as User;
  return {
    globalUser: { id: "7", discordUser: user } as unknown as GlobalUser,
    guild: { id: "1", name: "Test Guild" } as unknown as Guild,
    level,
    xp,
  };
}

describe("level-up placeholders", () => {
  test("renders the level, xp, user, and guild tokens", async () => {
    const text = await levelUpPlaceholders.replace(
      context(),
      "{user_mention} reached level {level} with {current_xp} XP in {guild_name}"
    );
    expect(text).toBe("<@7> reached level 5 with 1200 XP in Test Guild");
  });
});
