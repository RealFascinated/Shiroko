import type { Client } from "discord.js";
import type { JobSchedule } from "./schedule";

export interface JobInfo {
  /** Unique id; also the `name` label on every job metric. */
  readonly id: string;
  readonly schedule: JobSchedule;
  /** Run once as soon as the bot is ready, before the first scheduled tick. */
  readonly runOnReady?: boolean;
}

/**
 * A scheduled unit of work. Subclasses implement {@link run}; arming,
 * overlap protection, error isolation and metrics belong to `JobManager`, so
 * `run` may throw and need not guard itself against an unhandled rejection.
 */
export default abstract class Job {
  public readonly id: string;
  public readonly schedule: JobSchedule;
  public readonly runOnReady: boolean;

  protected constructor(info: JobInfo) {
    this.id = info.id;
    this.schedule = info.schedule;
    this.runOnReady = info.runOnReady ?? false;
  }

  public abstract run(client: Client): Promise<void>;
}
