import { GaugeMetric } from "../gauge";

/** Resident set size of the bot process in MiB. */
export class ProcessRamUsedMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;

  public constructor() {
    super({
      id: "shiroko_process_ram_used",
      kind: "gauge",
      help: "Resident set size of the bot process, in MiB",
      unit: "MiB",
    });
  }

  public override collect(): void {
    this.set(process.memoryUsage().rss / (1024 * 1024));
  }
}
