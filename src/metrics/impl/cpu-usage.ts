import os from "node:os";
import { GaugeMetric } from "../gauge";

/**
 * Process CPU usage as a percentage of total host capacity: delta of
 * `process.cpuUsage()` over the sampling window divided by the wall time
 * and the host's core count, clamped to [0, 100]. 100% means all cores
 * fully busy.
 */
export class ProcessCpuUsageMetric extends GaugeMetric {
  public override readonly collectIntervalMs: number = 5_000;
  private lastUsage: NodeJS.CpuUsage = process.cpuUsage();
  private lastWall: number = Date.now();

  public constructor() {
    super({
      id: "process_cpu_usage",
      kind: "gauge",
      help: "Process CPU usage as a percentage of all cores",
      unit: "%",
    });
  }

  public override collect(): void {
    const now = process.cpuUsage();
    const deltaMs = (now.user - this.lastUsage.user + (now.system - this.lastUsage.system)) / 1000;
    const wallMs = Date.now() - this.lastWall;
    const cores = os.cpus().length;
    const percent = wallMs > 0 ? Math.min(100, Math.max(0, (deltaMs / wallMs / cores) * 100)) : 0;
    this.set(percent);
    this.lastUsage = now;
    this.lastWall = Date.now();
  }
}
