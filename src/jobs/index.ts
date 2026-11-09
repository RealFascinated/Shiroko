import type { Client } from "discord.js";
import { EventBus } from "@/event/event-bus";
import { EventHandler } from "@/event/event-handler";
import { EventListener } from "@/event/event-listener";
import BotReadyEvent from "@/event/events/bot-ready.event";
import type { Metric } from "@/metrics/metric";
import {
  JobDurationMetric,
  JobFailuresMetric,
  JobIntervalMetric,
  JobLastSuccessMetric,
  JobRunsMetric,
  JobSkipsMetric,
} from "@/metrics/impl/jobs";
import type Job from "./job";

/**
 * The job registry and scheduler. Jobs are registered at boot and armed on
 * `BotReadyEvent`, so each run takes its `Client` from the event rather than
 * importing `discordClient`.
 *
 * Every run goes through {@link execute}: it never rejects (`Bun.cron` and
 * `setInterval` turn a rejected promise into an `unhandledRejection`, which
 * exits the process), it skips a tick while the previous run of the same
 * job is still going, and it records the run in the job metrics.
 */
export default class JobManager extends EventListener {
  public readonly runs: JobRunsMetric = new JobRunsMetric();
  public readonly failures: JobFailuresMetric = new JobFailuresMetric();
  public readonly skips: JobSkipsMetric = new JobSkipsMetric();
  public readonly duration: JobDurationMetric = new JobDurationMetric();
  public readonly lastSuccess: JobLastSuccessMetric = new JobLastSuccessMetric();
  public readonly interval: JobIntervalMetric = new JobIntervalMetric();

  private readonly jobs: Map<string, Job> = new Map<string, Job>();
  private readonly running: Set<string> = new Set<string>();
  private readonly disarms: (() => void)[] = [];

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  public get metrics(): Metric<any>[] {
    return [this.runs, this.failures, this.skips, this.duration, this.lastSuccess, this.interval];
  }

  public register(job: Job): void {
    if (this.jobs.has(job.id)) {
      throw new Error(`Job "${job.id}" is already registered`);
    }
    this.jobs.set(job.id, job);
    this.interval.set(job.id, job.schedule.periodMs / 1000);
  }

  /**
   * Re-armed on every ready because in-process timers die with the process;
   * the previous set is disarmed first so a second ready cannot register
   * duplicates.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    for (const disarm of this.disarms.splice(0)) {
      disarm();
    }
    for (const job of this.jobs.values()) {
      this.disarms.push(job.schedule.arm(() => void this.execute(job, event.client)));
      if (job.runOnReady) {
        void this.execute(job, event.client);
      }
    }
    console.log(`Armed ${this.jobs.size} job(s)`);
  }

  private async execute(job: Job, client: Client): Promise<void> {
    if (this.running.has(job.id)) {
      this.skips.increment(job.id);
      return;
    }
    this.running.add(job.id);
    const started = performance.now();
    try {
      await job.run(client);
      this.lastSuccess.set(job.id, Math.floor(Date.now() / 1000));
    } catch (error) {
      this.failures.increment(job.id);
      console.error(`Job ${job.id} failed:`, error);
    } finally {
      this.runs.increment(job.id);
      this.duration.set(job.id, (performance.now() - started) / 1000);
      this.running.delete(job.id);
    }
  }
}
