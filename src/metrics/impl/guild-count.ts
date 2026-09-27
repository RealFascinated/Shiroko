import { type Client } from "discord.js";
import { GaugeMetric } from "../gauge";

/**
 * Number of guilds the bot is in. Mirror of the presence text.
 */
export class GuildsMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;
  private readonly client: Client;

  public constructor(client: Client) {
    super({ id: "shiroko_guilds", kind: "gauge", help: "Number of guilds the bot is in" });
    this.client = client;
  }

  public override collect(): void {
    this.set(this.client.guilds.cache.size);
  }
}
