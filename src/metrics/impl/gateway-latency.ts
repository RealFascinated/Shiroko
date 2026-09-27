import { type Client } from "discord.js";
import { GaugeMetric } from "../gauge";

/**
 * Gateway heartbeat latency in milliseconds (`client.ws.ping`). Only
 * meaningful when the client is ready; the metric holds its last value
 * otherwise.
 */
export class GatewayLatencyMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;
  private readonly client: Client;

  public constructor(client: Client) {
    super({
      id: "shiroko_gateway_latency_ms",
      kind: "gauge",
      help: "Gateway heartbeat latency in milliseconds",
      unit: "ms",
    });
    this.client = client;
  }

  public override collect(): void {
    this.set(this.client.ws.ping);
  }
}
