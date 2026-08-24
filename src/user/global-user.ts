import type { User } from "discord.js";
import type { GlobalUserSchema } from "../db/schema";

export default class GlobalUser {
  public readonly id: string;
  public readonly firstSeen: Date;

  public readonly discordUser: User;

  constructor(discordUser: User, globalUser: GlobalUserSchema) {
    this.id = discordUser.id;
    this.firstSeen = globalUser.firstSeen;

    this.discordUser = discordUser;
  }
}
