import { EventHandler } from "@/event/event-handler";
import BotReadyEvent from "@/event/events/bot-ready.event";
import ComponentManager from "@/component/index";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import SettingsManager from "@/settings/index";
import { birthdaySettings } from "./birthday-settings";
import { runBirthdaySweep } from "./birthday-sweep";
import BirthdayWishComponent from "./birthday-wish.component";
import BirthdayCommand from "./command/birthday/birthday.command";

const CRON = "1 * * * *"; // hourly, so a missed midnight run is caught up

export default class BirthdayFeature extends Feature {
  private job: Bun.CronJob | undefined;

  constructor() {
    super(FeatureIds.Birthday, { name: "Birthdays", emoji: "🎂" });

    SettingsManager.register(birthdaySettings);
    ComponentManager.register(new BirthdayWishComponent());
    this.registerCommand(new BirthdayCommand());
  }

  /**
   * Arm the hourly sweep on ready and run it once straight away, so a
   * restart across midnight still announces; the claim table makes the
   * repeat runs harmless. Started from `BotReadyEvent` so the job takes its
   * `Client` from the event, mirroring `PresenceListener`.
   *
   * `Bun.cron`'s in-process job dies with the process, so it is re-armed on
   * every ready; the previous job is stopped first so a second ready cannot
   * register a duplicate. `tz: "UTC"` fixes "today" to the UTC date for
   * every guild.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    this.job?.stop();
    void runBirthdaySweep(event.client);
    this.job = Bun.cron(CRON, () => runBirthdaySweep(event.client), { tz: "UTC" });
  }
}
