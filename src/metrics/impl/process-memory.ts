import { Metric } from "../metric";

/**
 * The JS heap breakdown behind {@link ProcessRamUsedMetric}'s RSS, one
 * series per `kind`. A climbing `heap_used` with flat traffic is a leak
 * in JS objects (usually an unbounded map or cache); RSS climbing while
 * the heap stays flat points at native memory instead.
 */
export class ProcessMemoryMetric extends Metric<Record<string, number>> {
  public override readonly collectIntervalMs: number = 5_000;
  private current: Record<string, number> = {};

  public constructor() {
    super({
      id: "process_memory_bytes",
      kind: "counter_map",
      label: "kind",
      unit: "bytes",
      help: "JS heap and external memory of the bot process, in bytes",
    });
  }

  public override collect(): void {
    const usage = process.memoryUsage();
    this.current = {
      heap_used: usage.heapUsed,
      heap_total: usage.heapTotal,
      external: usage.external,
      array_buffers: usage.arrayBuffers,
    };
  }

  public value(): Record<string, number> {
    return this.current;
  }
}
