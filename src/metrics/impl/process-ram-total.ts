import os from "node:os";
import { GaugeMetric } from "../gauge";

/** Total physical memory of the host in bytes. */
export class ProcessRamTotalMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;

  public constructor() {
    super({
      id: "shiroko_process_ram_total",
      kind: "gauge",
      help: "Total physical memory of the host, in bytes",
      unit: "bytes",
    });
  }

  public override collect(): void {
    this.set(os.totalmem());
  }
}
