import { GaugeMetric } from "../gauge";

/** Process uptime in seconds. */
export class UptimeMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;

  public constructor() {
    super({
      id: "uptime_seconds",
      kind: "gauge",
      help: "Process uptime in seconds",
      unit: "s",
    });
  }

  public override collect(): void {
    this.set(process.uptime());
  }
}
