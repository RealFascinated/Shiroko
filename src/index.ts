import { Client, GatewayIntentBits } from "discord.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { CacheListeners } from "./cache/cache-listeners";
import CommandManager, { SlashCommandListener } from "./command/index";
import { Constants } from "./constants";
import ContextMenuCommandManager, { ContextMenuCommandListener } from "./context-menu/index";
import { db } from "./db/index";
import EventBridge from "./event/event-bridge";
import { EventBus } from "./event/event-bus";
import { EventHandler } from "./event/event-handler";
import { EventListener } from "./event/event-listener";
import BotReadyEvent from "./event/events/bot-ready.event";
import GuildJoinedEvent from "./event/events/guild-joined.event";
import GuildLeftEvent from "./event/events/guild-left.event";
import PostCommandLoadEvent from "./event/events/post-command-load.event";
import { BirthdayScheduler } from "./feature/impl/birthday/birthday-scheduler";
import FeatureManager from "./feature/index";
import { env } from "./lib/env";
import { DiscordBotListManager } from "./lib/misc/discordbotlist";
import { PresenceListener } from "./lib/presence";
import { formatDuration } from "./lib/time";
import { VoiceKeepaliveListener } from "./lib/voice";
import { EventVolumeListeners } from "./metrics/event-volume-listeners";
import { VictoriaMetricsExporter } from "./metrics/exporter";
import { CacheMetricsMetric } from "./metrics/impl/cache";
import { ProcessCpuUsageMetric } from "./metrics/impl/cpu-usage";
import { DiscordCacheMetric } from "./metrics/impl/discord-cache";
import { DiscordEventsMetric } from "./metrics/impl/discord-events";
import { EventLoopMetric } from "./metrics/impl/event-loop-delay";
import { GatewayLatencyMetric } from "./metrics/impl/gateway-latency";
import { GuildsMetric } from "./metrics/impl/guild-count";
import { ProcessRamTotalMetric } from "./metrics/impl/process-ram-total";
import { ProcessRamUsedMetric } from "./metrics/impl/process-ram-used";
import { SeenUsersMetric } from "./metrics/impl/seen-users";
import { UptimeMetric } from "./metrics/impl/uptime-seconds";
import { MetricManager } from "./metrics/index";
import PanelManager from "./panel/index";
import { PermissionsListeners } from "./permission/permissions";
import { settingsPanel } from "./settings/settings-panel";
import LoggingFeature from "./feature/impl/logging";

const beforeMigrate = Date.now();
await migrate(db, { migrationsFolder: "./drizzle" });
console.log(`Migrations complete in ${formatDuration(Date.now() - beforeMigrate)}`);

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildInvites,
  ],
});

new EventBridge(discordClient).registerHandlers();

export const metricManager = new MetricManager();
metricManager.register(new GuildsMetric(discordClient));
metricManager.register(new GatewayLatencyMetric(discordClient));
metricManager.register(new SeenUsersMetric());
metricManager.register(new ProcessRamUsedMetric());
metricManager.register(new ProcessRamTotalMetric());
metricManager.register(new ProcessCpuUsageMetric());
metricManager.register(new UptimeMetric());
metricManager.register(new EventLoopMetric());
metricManager.register(new CacheMetricsMetric());
metricManager.register(new DiscordCacheMetric(discordClient));
const discordEventsMetric = metricManager.register(new DiscordEventsMetric());
new EventVolumeListeners(discordEventsMetric);

/**
 * Guild lifecycle logging and one-time command sync on ready. Lives here
 * because it's the entry-level wiring: ready-sync pushes the command set
 * to Discord and logs join/leave.
 */
class LifecycleListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    const client = event.client;
    console.log(`Ready! Logged in as ${client.user?.tag}`);

    const application = client.application;
    if (!application) {
      throw new Error("Application is not available");
    }
    const allCommands = [...new CommandManager().build(), ...new ContextMenuCommandManager().build()];
    await application.commands.set(allCommands);
    console.log(`Synced ${allCommands.length} command(s)`);
    await EventBus.post(new PostCommandLoadEvent(client, allCommands));
  }

  @EventHandler(GuildJoinedEvent)
  public async onGuildJoined(event: GuildJoinedEvent): Promise<void> {
    const client = event.guildData.client;
    console.log(
      `Joined "${event.guildData.name}" (${event.guildData.memberCount} members); now in ${client.guilds.cache.size} guild(s)`
    );
  }

  @EventHandler(GuildLeftEvent)
  public async onGuildLeft(event: GuildLeftEvent): Promise<void> {
    const client = event.guildData.client;
    console.log(
      `Left "${event.guildData.name}" (${event.guildData.memberCount} members); now in ${client.guilds.cache.size} guild(s)`
    );
  }
}

const VOICE_CHANNEL_ID = "1446633266160603268";
new VoiceKeepaliveListener(VOICE_CHANNEL_ID);

new LifecycleListeners();
new PresenceListener();
new PermissionsListeners();
new CacheListeners();
new PanelManager();
PanelManager.register(settingsPanel);
new SlashCommandListener();
new ContextMenuCommandListener();

new FeatureManager();
new LoggingFeature();
new BirthdayScheduler();

if (env.VM_PUSH_URL) {
  const exporter = new VictoriaMetricsExporter(metricManager, {
    url: env.VM_PUSH_URL,
    job: Constants.botName,
    intervalMs: Number(env.VM_PUSH_INTERVAL_MS ?? 60_000),
  });
  exporter.start();
  console.log(
    `Pushing metrics to VictoriaMetrics at ${env.VM_PUSH_URL} every ${Number(env.VM_PUSH_INTERVAL_MS ?? 60_000) / 1000}s`
  );
} else {
  console.log("VM_PUSH_URL not set; metrics collection is on, push is off");
}

if (env.DISCORDBOTLIST_TOKEN) {
  new DiscordBotListManager({ token: env.DISCORDBOTLIST_TOKEN });
  console.log("Publishing commands and hourly statistics to discordbotlist.com");
} else {
  console.log("DISCORDBOTLIST_TOKEN not set; discordbotlist.com publishing is off");
}

discordClient.login(env.DISCORD_BOT_TOKEN);

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
