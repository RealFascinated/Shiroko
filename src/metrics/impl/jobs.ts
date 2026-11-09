import { Metric, type MetricRegistration } from "../metric";

/**
 * One series per job id under the `name` label. Not `job`: the exporter
 * already stamps `job` on every series with the bot's name, and a second
 * `job` label would make the line invalid. Subclasses pick whether a write
 * accumulates or replaces.
 */
abstract class JobMapMetric extends Metric<Record<string, number>> {
  protected readonly values: Map<string, number> = new Map<string, number>();

  protected constructor(registration: Omit<MetricRegistration, "label">) {
    super({ ...registration, label: "name" });
  }

  public value(): Record<string, number> {
    return Object.fromEntries(this.values);
  }
}

abstract class JobCounterMetric extends JobMapMetric {
  public increment(job: string): void {
    this.values.set(job, (this.values.get(job) ?? 0) + 1);
  }
}

abstract class JobGaugeMetric extends JobMapMetric {
  public set(job: string, value: number): void {
    this.values.set(job, value);
  }
}

export class JobRunsMetric extends JobCounterMetric {
  public constructor() {
    super({ id: "job_runs_total", kind: "counter_map", help: "Job runs since boot, by job" });
  }
}

export class JobFailuresMetric extends JobCounterMetric {
  public constructor() {
    super({ id: "job_failures_total", kind: "counter_map", help: "Job runs that threw, by job" });
  }
}

/**
 * Ticks dropped because the previous run of the same job was still going. A
 * climbing series means the job takes longer than its period.
 */
export class JobSkipsMetric extends JobCounterMetric {
  public constructor() {
    super({
      id: "job_skips_total",
      kind: "counter_map",
      help: "Job ticks skipped while still running, by job",
    });
  }
}

export class JobDurationMetric extends JobGaugeMetric {
  public constructor() {
    super({
      id: "job_last_duration_seconds",
      kind: "counter_map",
      unit: "seconds",
      help: "Duration of each job's most recent run",
    });
  }
}

export class JobLastSuccessMetric extends JobGaugeMetric {
  public constructor() {
    super({
      id: "job_last_success_timestamp_seconds",
      kind: "counter_map",
      unit: "seconds",
      help: "Unix time of each job's most recent successful run",
    });
  }
}

export class JobIntervalMetric extends JobGaugeMetric {
  public constructor() {
    super({
      id: "job_interval_seconds",
      kind: "counter_map",
      unit: "seconds",
      help: "Seconds between each job's scheduled ticks",
    });
  }
}
