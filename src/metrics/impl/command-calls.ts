import CommandCallService from "../command-calls.service";
import { Metric } from "../metric";

/**
 * Command invocations since the table was created, one series per
 * top-level command (`command_calls_total{command="ping"}`). The values
 * are cumulative and live in Postgres rather than memory, so they survive
 * restarts; `rate()` over the series is the per-command usage trend.
 */
export class CommandCallsMetric extends Metric<Record<string, number>> {
  public override readonly collectIntervalMs = 30_000;
  private current: Record<string, number> = {};

  public constructor() {
    super({
      id: "command_calls_total",
      kind: "counter_map",
      label: "command",
      help: "Slash command invocations, by command",
    });
  }

  public override async collect(): Promise<void> {
    this.current = await CommandCallService.totals();
  }

  public value(): Record<string, number> {
    return this.current;
  }
}
