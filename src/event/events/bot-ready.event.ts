import type { Client } from "discord.js";
import Event from "../event";

export default class BotReadyEvent extends Event {
  public readonly client: Client;

  constructor(client: Client) {
    super();
    this.client = client;
  }
}
