import type { ApplicationCommandDataResolvable, Client } from "discord.js";
import Event from "../event";

/**
 * The application command set finished syncing to Discord, so every
 * locally built command is live. Carries the payload that was pushed,
 * letting consumers publish what Discord actually holds rather than
 * re-deriving it.
 */
export default class PostCommandLoadEvent extends Event {
  public readonly client: Client;
  public readonly commands: readonly ApplicationCommandDataResolvable[];

  constructor(client: Client, commands: readonly ApplicationCommandDataResolvable[]) {
    super();
    this.client = client;
    this.commands = commands;
  }
}
