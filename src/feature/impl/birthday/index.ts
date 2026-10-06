import { EventHandler } from "@/event/event-handler";
import BotReadyEvent from "@/event/events/bot-ready.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import SettingsManager from "@/settings/index";
import { birthdaySettings } from "./birthday-settings";
import { runBirthdaySweep } from "./birthday-sweep";
import BirthdayCommand from "./command/birthday/birthday.command";

const CRON = "1 0 * * *"; // 00:01 daily

export default class BirthdayFeature extends Feature {
  private job: Bun.CronJob | undefined;

  constructor() {
    super(FeatureIds.Birthday, { name: "Birthdays", emoji: "🎂" });

    SettingsManager.register(birthdaySettings);
    this.registerCommand(new BirthdayCommand());
  }

  /**
   * Arm the nightly sweep on ready. Started from `BotReadyEvent` rather than
   * at construction so the job takes its `Client` from the event instead of
   * importing `discordClient` (which would pull in `src/index.ts` and its
   * cycle), mirroring `PresenceListener`.
   *
   * `Bun.cron`'s in-process job dies with the process, so it is re-armed on
   * every ready; the previous job is stopped first so a second ready cannot
   * register a duplicate. `tz: "UTC"` fixes "today" to the UTC date for
   * every guild.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    this.job?.stop();
    this.job = Bun.cron(CRON, () => runBirthdaySweep(event.client), { tz: "UTC" });
  }
}
