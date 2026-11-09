/**
 * When a job fires. A schedule arms a tick and hands back the function that
 * disarms it, so the manager can stop every job without knowing which timer
 * primitive backs it.
 */
export abstract class JobSchedule {
  public abstract arm(tick: () => void): () => void;
}

/**
 * A standard 5-field cron expression, evaluated in UTC so "midnight" is the
 * same instant for every guild.
 */
export class CronSchedule extends JobSchedule {
  public constructor(private readonly expression: string) {
    super();
  }

  public arm(tick: () => void): () => void {
    const job = Bun.cron(this.expression, tick, { tz: "UTC" });
    return () => job.stop();
  }
}

/**
 * A fixed period. `Bun.cron` cannot express a sub-minute schedule, so this
 * covers the fast sweeps.
 */
export class IntervalSchedule extends JobSchedule {
  public constructor(private readonly intervalMs: number) {
    super();
  }

  public arm(tick: () => void): () => void {
    const timer = setInterval(tick, this.intervalMs);
    return () => clearInterval(timer);
  }
}
