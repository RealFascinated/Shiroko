import type { Client } from "discord.js";
import Event from "../event";

/**
 * The Discord client is ready: gateway connected, cache populated.
 */
export default class BotReadyEvent extends Event {
  public readonly client: Client;

  constructor(client: Client) {
    super();
    this.client = client;
  }
}
