import { CounterMapMetric } from "../counter-map";
import { HistogramMapMetric } from "../histogram-map";

/**
 * Wall time of each command's handler in milliseconds, keyed by top-level
 * slash command id or context menu display name. Covers the whole handler,
 * deferred work included, so it is the time until the command finished
 * rather than until Discord saw an acknowledgement (see
 * {@link InteractionAckMetric}).
 */
export class CommandDurationMetric extends HistogramMapMetric {
  public constructor() {
    super(
      {
        id: "command_duration_ms",
        label: "command",
        unit: "ms",
        help: "Command handler duration in milliseconds",
      },
      [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]
    );
  }
}

export class CommandErrorsMetric extends CounterMapMetric {
  public constructor() {
    super({ id: "command_errors_total", label: "command", help: "Command handlers that threw, by command" });
  }
}
