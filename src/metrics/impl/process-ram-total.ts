import os from "node:os";
import { GaugeMetric } from "../gauge";

/** Total physical memory of the host in MiB. */
export class ProcessRamTotalMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;

  public constructor() {
    super({
      id: "shiroko_process_ram_total",
      kind: "gauge",
      help: "Total physical memory of the host, in MiB",
      unit: "MiB",
    });
  }

  public override collect(): void {
    this.set(os.totalmem() / (1024 * 1024));
  }
}
