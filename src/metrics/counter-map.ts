import type { MetricRegistration } from "./metric";
import { Metric } from "./metric";

/**
 * A family of monotonic counters, one series per key under the metric's
 * label. Keys appear on first increment, so a series that has never fired
 * is absent rather than zero.
 */
export class CounterMapMetric extends Metric<Record<string, number>> {
  private readonly counts: Map<string, number> = new Map<string, number>();

  public constructor(registration: Omit<MetricRegistration, "kind">) {
    super({ ...registration, kind: "counter_map" });
  }

  public increment(key: string, by = 1): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + by);
  }

  public value(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}
