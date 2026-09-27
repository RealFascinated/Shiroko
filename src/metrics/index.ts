import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import BotReadyEvent from "../event/events/bot-ready.event";
import { DuplicateMetricError } from "./errors";
import type { MetricKind } from "./metric";
import { type Metric } from "./metric";

/**
 * The metric subsystem: a registry plus the collection wiring. Extends
 * {@link EventListener} so it can subscribe to the bus and start each
 * registered metric's `collect()` loop once the bot is ready.
 *
 * Registration is global to the process and spans all features; there is
 * no feature gating (see DESIGN.md "Metrics"). Adding a metric is:
 * `manager.register(new XMetric())`; the manager handles its timer from
 * the metric's own `collectIntervalMs`.
 */
export class MetricManager extends EventListener {
  private readonly metrics = new Map<string, Metric<any>>();
  private readonly timers = new Set<Timer>();

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  /**
   * Register a metric. The registration object carries the serialization
   * kind; the metric instance itself drives its typed API.
   */
  public register<TMetric extends Metric<any>>(metric: TMetric): TMetric {
    if (this.metrics.has(metric.id)) {
      throw new DuplicateMetricError(metric.id);
    }
    this.metrics.set(metric.id, metric);
    return metric;
  }

  /** All registered metrics, in registration order. */
  public all(): Metric<any>[] {
    return Array.from(this.metrics.values());
  }

  /** A snapshot of every metric's value, suitable for serialization. */
  public snapshot(): MetricSnapshot[] {
    const out: MetricSnapshot[] = [];
    for (const metric of this.metrics.values()) {
      if (!metric.hasCollected()) {
        // Never collected yet: reporting the initial zero would show a
        // bogus 0 in the dashboard before the first real sample.
        continue;
      }
      out.push({ id: metric.id, kind: metric.kind, value: metric.value() });
    }
    return out;
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(): Promise<void> {
    if (this.timers.size > 0) {
      return;
    }
    for (const metric of this.all()) {
      const collect = (): void => {
        const result = metric.collect();
        if (result instanceof Promise) {
          void result.finally(() => metric.markCollected());
        } else {
          metric.markCollected();
        }
      };
      collect();
      this.timers.add(setInterval(collect, metric.collectIntervalMs));
    }
  }
}

export interface MetricSnapshot {
  readonly id: string;
  readonly kind: MetricKind;
  readonly value: unknown;
}
