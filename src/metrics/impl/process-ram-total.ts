import { getHeapStatistics } from "node:v8";
import { GaugeMetric } from "../gauge";

/** Max heap size of the bot process in bytes. */
export class ProcessRamTotalMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;

  public constructor() {
    super({
      id: "process_ram_total",
      kind: "gauge",
      help: "Max heap size of the bot process, in bytes",
      unit: "bytes",
    });
  }

  public override collect(): void {
    this.set(getHeapStatistics().heap_size_limit);
  }
}
