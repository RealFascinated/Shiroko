import { GaugeMetric } from "../gauge";

export class ProcessRamUsedMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;

  public constructor() {
    super({
      id: "process_ram_used",
      kind: "gauge",
      help: "Resident set size of the bot process, in bytes",
      unit: "bytes",
    });
  }

  public override collect(): void {
    this.set(process.memoryUsage().rss);
  }
}
