import { GaugeMetric } from "../gauge";

/**
 * Process CPU usage as a percentage of one core (100% = one core fully
 * busy). Computed from the `process.cpuUsage()` delta over the sampling
 * window, clamped to [0, 100]. State (the previous sample) lives on the
 * instance so it survives across collector ticks.
 */
export class ProcessCpuUsageMetric extends GaugeMetric {
  public override readonly collectIntervalMs = 5_000;
  private lastUsage = process.cpuUsage();
  private lastWall = Date.now();

  public constructor() {
    super({
      id: "shiroko_process_cpu_usage",
      kind: "gauge",
      help: "Process CPU usage as a percentage of one core",
      unit: "%",
    });
  }

  public override collect(): void {
    const now = process.cpuUsage();
    const deltaMs = (now.user - this.lastUsage.user + (now.system - this.lastUsage.system)) / 1000;
    const wallMs = Date.now() - this.lastWall;
    const percent = wallMs > 0 ? Math.min(100, Math.max(0, (deltaMs / wallMs) * 100)) : 0;
    this.set(percent);
    this.lastUsage = now;
    this.lastWall = Date.now();
  }
}
