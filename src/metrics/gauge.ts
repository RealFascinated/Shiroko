import type { MetricRegistration } from "./metric";
import { Metric } from "./metric";

/**
 * A gauge holds a single numeric value that can go up or down. Values are
 * set wholesale, never incremented; use {@link CounterMetric} for
 * monotonic counts.
 */
export class GaugeMetric extends Metric<number> {
  private current: number;

  public constructor(registration: MetricRegistration, initial = 0) {
    super(registration);
    this.current = initial;
  }

  public set(value: number): void {
    this.current = value;
  }

  public value(): number {
    return this.current;
  }
}
