import { EventHandler } from "@/event/event-handler";
import BotReadyEvent from "@/event/events/bot-ready.event";
import GuildLeftEvent from "@/event/events/guild-left.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import SettingsManager from "@/settings/index";
import YoutubeCommand from "./command/youtube/youtube.command";
import { runYoutubePoll } from "./youtube-poller";
import { youtubeSettings } from "./youtube-settings";
import { YoutubeService } from "./youtube.service";

const POLL_CRON = "*/5 * * * *"; // every 5 minutes
const PRUNE_CRON = "0 4 * * *"; // 04:00 daily

/**
 * The YouTube feature: `/youtube` plus the poll that announces new uploads
 * and the nightly sweep that prunes the dedupe table.
 */
export default class YoutubeFeature extends Feature {
  private pollJob: Bun.CronJob | undefined;
  private pruneJob: Bun.CronJob | undefined;

  constructor() {
    super(FeatureIds.Youtube, { name: "YouTube", emoji: "📺" });

    SettingsManager.register(youtubeSettings);
    this.registerCommand(new YoutubeCommand());
  }

  /**
   * Arm the jobs on ready. Started from `BotReadyEvent` rather than at
   * construction so the poller takes its `Client` from the event instead of
   * importing `discordClient` (which would pull in `src/index.ts` and its
   * cycle), mirroring `BirthdayFeature`. Both jobs are re-armed on every
   * ready, stopping the previous ones so a second ready cannot duplicate them.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    this.pollJob?.stop();
    this.pruneJob?.stop();
    this.pollJob = Bun.cron(POLL_CRON, () => runYoutubePoll(event.client), { tz: "UTC" });
    this.pruneJob = Bun.cron(PRUNE_CRON, () => YoutubeService.pruneSeenUploads(), { tz: "UTC" });
  }

  /**
   * A departed guild's subscriptions are dead weight the poller would keep
   * fetching for, so drop them and any channel left orphaned.
   */
  @EventHandler(GuildLeftEvent)
  public async onGuildLeft(event: GuildLeftEvent): Promise<void> {
    try {
      await YoutubeService.removeGuild(event.guildData.id);
    } catch (error) {
      console.error(`Failed to clean up YouTube subscriptions for guild ${event.guildData.id}:`, error);
    }
  }
}
