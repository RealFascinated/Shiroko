export type MetricKind = "gauge" | "histogram" | "counter" | "counter_map";

/**
 * Every metric carries the same registration metadata: an id, the
 * serialization kind, help text, and an optional unit.
 */
export interface MetricRegistration {
  readonly id: string;
  readonly kind: MetricKind;
  readonly help: string;
  readonly unit?: string;
  /**
   * For `counter_map`: the label each map key is exported under
   * (defaults to `event`). Keys must be valid Prometheus label names.
   */
  readonly label?: string;
}

/**
 * Base class for all metrics. Generic over the value it holds: a number
 * for gauges or a histogram value. Subclasses expose typed setters over
 * the store, serialize through {@link value}, and run their own
 * collection: {@link collectIntervalMs} and {@link collect} drive the
 * manager's timer, so registering a new metric is just
 * `manager.register(new XMetric())`.
 */
export abstract class Metric<T = unknown> {
  /** Set by subclasses: how often {@link collect} should run, in ms. */
  declare public readonly collectIntervalMs: number;

  public readonly id: string;
  public readonly kind: MetricKind;
  public readonly help: string;
  public readonly unit?: string;
  /** The label `counter_map` keys are exported under. See {@link MetricRegistration}. */
  public readonly label: string;

  /** Whether {@link collect} has run at least once. */
  private collected = false;

  protected constructor(registration: MetricRegistration) {
    this.id = registration.id;
    this.kind = registration.kind;
    this.help = registration.help;
    this.unit = registration.unit;
    this.label = registration.label ?? "event";
  }

  /** Whether {@link collect} has run at least once. */
  public hasCollected(): boolean {
    return this.collected;
  }

  /** Mark this metric as collected. Called by the manager's collect loop. */
  public markCollected(): void {
    this.collected = true;
  }

  /** Current value, in the shape the serializer understands. */
  public abstract value(): T;

  /**
   * Read the live value and update the metric. Default is a no-op for
   * plain value metrics (e.g. a fixed gauge); self-collecting subclasses
   * override it and declare a real {@link collectIntervalMs}.
   */
  public collect(): void | Promise<void> {}
}
