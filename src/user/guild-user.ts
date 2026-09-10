import type { User } from "discord.js";
import type { GuildUserSchema } from "../db/schema";

export default class GuildUser {
  public readonly guildId: string;
  public readonly userId: string;
  public readonly lastMessageAt: Date | null;
  public readonly firstSeen: Date;

  public readonly discordUser: User;

  constructor(discordUser: User, guildUser: GuildUserSchema) {
    this.guildId = guildUser.guildId;
    this.userId = guildUser.userId;
    this.lastMessageAt = guildUser.lastMessageAt;
    this.firstSeen = guildUser.firstSeen;

    this.discordUser = discordUser;
  }
}
