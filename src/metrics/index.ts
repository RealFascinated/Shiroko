import type { Client } from "discord.js";
import { isPrimary } from "../cluster/cluster";
import { pool } from "../db/index";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import BotReadyEvent from "../event/events/bot-ready.event";
import type JobManager from "../jobs/index";
import StorageService from "../storage/storage";
import { DbListeners } from "./db-listeners";
import { DuplicateMetricError } from "./errors";
import { EventVolumeListeners } from "./event-volume-listeners";
import { GatewayListeners } from "./gateway-listeners";
import { CacheMetricsMetric } from "./impl/cache";
import { ClusterCountMetric } from "./impl/cluster-count";
import { CommandCallsMetric } from "./impl/command-calls";
import { CommandDurationMetric, CommandErrorsMetric } from "./impl/commands";
import { ProcessCpuUsageMetric } from "./impl/cpu-usage";
import { DiscordCacheMetric } from "./impl/discord-cache";
import { DiscordEventsMetric } from "./impl/discord-events";
import { EventLoopMetric } from "./impl/event-loop-delay";
import { GatewayLatencyMetric } from "./impl/gateway-latency";
import { GuildsMetric } from "./impl/guild-count";
import { MediaBytesMetric, MediaFilesMetric } from "./impl/media";
import { ProcessMemoryMetric } from "./impl/process-memory";
import { ProcessRamTotalMetric } from "./impl/process-ram-total";
import { ProcessRamUsedMetric } from "./impl/process-ram-used";
import { SeenUsersMetric } from "./impl/seen-users";
import { UptimeMetric } from "./impl/uptime-seconds";
import type { MetricKind } from "./metric";
import { type Metric } from "./metric";
import { RestListeners } from "./rest-listeners";

/**
 * The metric subsystem: a registry plus the collection wiring. Extends
 * {@link EventListener} so it can subscribe to the bus and start each
 * registered metric's `collect()` loop once the bot is ready.
 *
 * Registration is global to the process and spans all features; there is
 * no feature gating (see DESIGN.md "Metrics"). Adding a metric is one
 * `register` call in the constructor; the manager handles its timer from
 * the metric's own `collectIntervalMs`.
 */
export class MetricManager extends EventListener {
  private readonly metrics: Map<string, Metric<any>> = new Map<string, Metric<any>>();
  private readonly timers: Set<Timer> = new Set<Timer>();
  public readonly commandDuration: CommandDurationMetric;
  public readonly commandErrors: CommandErrorsMetric;

  constructor(client: Client, jobs: JobManager) {
    super();
    EventBus.subscribe(this);
    this.register(new GuildsMetric(client));
    this.register(new GatewayLatencyMetric(client));
    this.register(new ClusterCountMetric(client));
    this.register(new ProcessRamUsedMetric());
    this.register(new ProcessRamTotalMetric());
    this.register(new ProcessMemoryMetric());
    this.register(new ProcessCpuUsageMetric());
    this.register(new UptimeMetric());
    this.register(new EventLoopMetric());
    this.register(new CacheMetricsMetric());
    this.register(new DiscordCacheMetric(client));
    new EventVolumeListeners(this.register(new DiscordEventsMetric()));
    this.commandDuration = this.register(new CommandDurationMetric());
    this.commandErrors = this.register(new CommandErrorsMetric());
    for (const metric of [
      ...new RestListeners(client).metrics,
      ...new DbListeners(pool).metrics,
      ...new GatewayListeners().metrics,
      ...EventBus.metrics,
      ...StorageService.metrics,
      ...jobs.metrics,
    ]) {
      this.register(metric);
    }
    // DB-backed values read the same from every cluster, so only the primary
    // reports them; otherwise a dashboard sum would count them once per cluster.
    if (isPrimary(client)) {
      this.register(new SeenUsersMetric());
      this.register(new MediaFilesMetric());
      this.register(new MediaBytesMetric());
      this.register(new CommandCallsMetric());
    }
  }

  /**
   * Register a metric. The registration object carries the serialization
   * kind; the metric instance itself drives its typed API.
   */
  private register<TMetric extends Metric<any>>(metric: TMetric): TMetric {
    if (this.metrics.has(metric.id)) {
      throw new DuplicateMetricError(metric.id);
    }
    this.metrics.set(metric.id, metric);
    return metric;
  }

  /**
   * All registered metrics, in registration order.
   */
  public all(): Metric<any>[] {
    return Array.from(this.metrics.values());
  }

  public snapshot(): MetricSnapshot[] {
    const out: MetricSnapshot[] = [];
    for (const metric of this.metrics.values()) {
      if (!metric.hasCollected()) {
        // Never collected yet: reporting the initial zero would show a
        // bogus 0 in the dashboard before the first real sample.
        continue;
      }
      out.push({ id: metric.id, kind: metric.kind, label: metric.label, value: metric.value() });
    }
    return out;
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(): Promise<void> {
    if (this.timers.size > 0) {
      return;
    }
    for (const metric of this.all()) {
      if (metric.collectIntervalMs === undefined) {
        metric.markCollected();
        continue;
      }
      const collect = async (): Promise<void> => {
        try {
          await metric.collect();
        } finally {
          metric.markCollected();
        }
      };
      void collect();
      this.timers.add(setInterval(() => void collect(), metric.collectIntervalMs));
    }
  }
}

export interface MetricSnapshot {
  readonly id: string;
  readonly kind: MetricKind;
  /** The label `counter_map` keys are exported under. */
  readonly label: string;
  readonly value: unknown;
}
