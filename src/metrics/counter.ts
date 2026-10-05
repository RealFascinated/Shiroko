import type { MetricRegistration } from "./metric";
import { Metric } from "./metric";

/**
 * A counter holds a single monotonic total. Use {@link CounterMetric} when
 * the series is event-driven and the value only ever climbs; use
 * {@link GaugeMetric} for a value that can go down.
 */
export class CounterMetric extends Metric<number> {
  private total: number;

  public constructor(registration: MetricRegistration, initial = 0) {
    super(registration);
    this.total = initial;
  }

  public increment(by = 1): void {
    this.total += by;
  }

  public value(): number {
    return this.total;
  }
}
