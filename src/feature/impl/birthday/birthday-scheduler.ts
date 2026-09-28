import { EventBus } from "../../../event/event-bus";
import { EventHandler } from "../../../event/event-handler";
import { EventListener } from "../../../event/event-listener";
import BotReadyEvent from "../../../event/events/bot-ready.event";
import { runBirthdaySweep } from "./birthday-sweep";

const CRON = "1 0 * * *"; // 00:01 daily

/**
 * Arms the nightly birthday sweep. Started from `BotReadyEvent` rather
 * than at module load so the handler can take its `Client` from the event
 * instead of importing `discordClient` (which would pull in `src/index.ts`
 * and its cycle), mirroring `PresenceListener`.
 *
 * `Bun.cron`'s in-process job dies with the process, so it is re-armed on
 * every ready; the previous job is stopped first so a second ready cannot
 * register a duplicate. `tz: "UTC"` fixes "today" to the UTC date for
 * every guild.
 */
export class BirthdayScheduler extends EventListener {
  private job: Bun.CronJob | undefined;

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    this.job?.stop();
    this.job = Bun.cron(CRON, () => runBirthdaySweep(event.client), { tz: "UTC" });
  }
}
