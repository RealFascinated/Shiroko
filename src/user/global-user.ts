import type { User } from "discord.js";

export default class GlobalUser {
  public readonly id: string;
  public readonly discordUser: User;

  constructor(id: string, discordUser: User) {
    this.id = id;
    this.discordUser = discordUser;
  }
}
