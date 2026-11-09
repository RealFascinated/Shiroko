import { CounterMetric } from "../counter";
import { HistogramMetric } from "../histogram";

/**
 * Milliseconds between a reminder's due time and its delivery. The sweep
 * runs every 30 seconds, so a healthy bot stays under that; anything past
 * it means the sweep is skipping ticks or delivery is slow.
 */
export class ReminderLagMetric extends HistogramMetric {
  public constructor() {
    super(
      {
        id: "reminder_delivery_lag_ms",
        kind: "histogram",
        unit: "ms",
        help: "Reminder delivery lag past its due time, in milliseconds",
      },
      [1000, 5000, 15000, 30000, 60000, 300000, 900000, 3600000]
    );
  }
}

/**
 * Claimed reminders that reached neither their channel nor the owner's DMs.
 * The row is already deleted at that point, so each one is lost for good.
 */
export class RemindersDroppedMetric extends CounterMetric {
  public constructor() {
    super({
      id: "reminders_dropped_total",
      kind: "counter",
      help: "Due reminders that could not be delivered anywhere",
    });
  }
}
