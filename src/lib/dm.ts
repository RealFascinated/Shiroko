import type { DMChannel, User } from "discord.js";

/**
 * Open (or fetch) the bot's DM channel with `user`. Returns `null` when the
 * channel cannot be opened, which is the normal outcome when the user does
 * not accept DMs from the bot.
 *
 * Needs no `DirectMessages` intent: that intent gates *receiving* direct
 * messages, not sending them.
 */
export async function openDmChannel(user: User): Promise<DMChannel | null> {
  try {
    return await user.createDM();
  } catch {
    return null;
  }
}
