import { EventHandler } from "@/event/event-handler";
import BotReadyEvent from "@/event/events/bot-ready.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import ReminderCommand from "./command/reminder/reminder.command";
import { runReminderSweep } from "./reminder-sweep";

const SWEEP_INTERVAL_MS = 30_000;

/**
 * The reminder feature: `/reminder` plus the 30-second sweep that delivers
 * due reminders.
 *
 * `toggleable: false` because reminders are global rather than a guild
 * feature: `GuildFeatures.isFeatureEnabled` short-circuits to `true` for a
 * non-toggleable feature, so no stored row can disable them and they never
 * appear in `/feature`.
 */
export default class RemindersFeature extends Feature {
  private timer: Timer | undefined;

  constructor() {
    super(FeatureIds.Reminders, { toggleable: false, name: "Reminders", emoji: "⏰" });
    this.registerCommand(new ReminderCommand());
  }

  /**
   * Arm the sweep on ready. Started from `BotReadyEvent` rather than at
   * construction so the sweep takes its `Client` from the event instead of
   * importing `discordClient` (which would pull in `src/index.ts` and its
   * cycle), mirroring `PresenceListener`.
   *
   * `Bun.cron` takes a standard 5-field expression, so it cannot express a
   * sub-minute schedule; a 30-second sweep is a `setInterval`. The handle
   * is per-process, so it is re-armed on every ready and the previous one is
   * cleared first, so a second ready cannot register a duplicate sweeper.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    clearInterval(this.timer);
    this.timer = setInterval(() => void runReminderSweep(event.client), SWEEP_INTERVAL_MS);
  }
}
