import { type Client } from "discord.js";
import { GaugeMetric } from "../gauge";

/**
 * How many clusters the deploy is configured for, so an alert can compare it
 * with how many are actually pushing.
 */
export class ClusterCountMetric extends GaugeMetric {
  public override readonly collectIntervalMs: number = 60_000;
  private readonly client: Client;

  public constructor(client: Client) {
    super({ id: "cluster_count", kind: "gauge", help: "Number of clusters the bot is configured to run" });
    this.client = client;
  }

  public override collect(): void {
    this.set(this.client.cluster.count);
  }
}
