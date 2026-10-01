import { EventBus } from "@/event/event-bus";
import { EventHandler } from "@/event/event-handler";
import { EventListener } from "@/event/event-listener";
import BotReadyEvent from "@/event/events/bot-ready.event";
import { runMediaSweep } from "./media.service";

const SWEEP_CRON = "0 3 * * *"; // 03:00 daily

/**
 * Arms the nightly expiry sweep. Capturing a change belongs to the caller
 * that owns the event (`EventBridge`), so every listener receives resolved
 * URLs; this listener only owns the TTL lifecycle.
 */
export class MediaListeners extends EventListener {
  private job: Bun.CronJob | undefined;

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(): Promise<void> {
    this.job?.stop();
    this.job = Bun.cron(SWEEP_CRON, () => runMediaSweep(), { tz: "UTC" });
  }
}
