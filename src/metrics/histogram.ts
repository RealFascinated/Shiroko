import type { MetricRegistration } from "./metric";
import { Metric } from "./metric";

/**
 * A histogram records observations into fixed buckets. The buckets are set
 * at construction and exported as `le` label boundaries; the value is a
 * count per bucket plus the total sum and count.
 *
 * `counts[i]` is the number of observations that fell *into* bucket `i`,
 * not the number at or below its bound: the exporter does the cumulative
 * sum that gives the `le` semantics, so counting cumulatively here would
 * count every observation once per matching bucket.
 */
export class HistogramMetric extends Metric<HistogramValue> {
  private readonly counts: number[];
  private total: number;
  private count: number;

  public constructor(
    registration: MetricRegistration,
    public readonly buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ) {
    super(registration);
    this.counts = new Array(buckets.length).fill(0);
    this.total = 0;
    this.count = 0;
  }

  public observe(value: number): void {
    this.total += value;
    this.count += 1;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]!) {
        this.counts[i]! += 1;
        break;
      }
    }
  }

  public value(): HistogramValue {
    return {
      buckets: this.buckets,
      counts: this.counts,
      sum: this.total,
      count: this.count,
    };
  }
}

export interface HistogramValue {
  readonly buckets: readonly number[];
  readonly counts: readonly number[];
  readonly sum: number;
  readonly count: number;
}
