import { HistogramMetric, type HistogramValue } from "./histogram";
import type { MetricRegistration } from "./metric";
import { Metric } from "./metric";

/**
 * A family of histograms sharing one set of buckets, one per key under the
 * metric's label. The exporter emits each key's buckets with both that label
 * and `le`, so `histogram_quantile` works per key or summed across them.
 */
export class HistogramMapMetric extends Metric<Record<string, HistogramValue>> {
  private readonly histograms: Map<string, HistogramMetric> = new Map<string, HistogramMetric>();

  public constructor(
    private readonly registration: Omit<MetricRegistration, "kind">,
    private readonly buckets: number[]
  ) {
    super({ ...registration, kind: "histogram_map" });
  }

  public observe(key: string, value: number): void {
    let histogram = this.histograms.get(key);
    if (!histogram) {
      histogram = new HistogramMetric({ ...this.registration, kind: "histogram" }, this.buckets);
      this.histograms.set(key, histogram);
    }
    histogram.observe(value);
  }

  public value(): Record<string, HistogramValue> {
    return Object.fromEntries(Array.from(this.histograms, ([key, histogram]) => [key, histogram.value()]));
  }
}
