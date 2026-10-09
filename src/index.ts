import { Client, GatewayIntentBits, type ApplicationCommandDataResolvable } from "discord.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { CacheListeners } from "./cache/cache-listeners";
import CommandManager, { SlashCommandListener } from "./command/index";
import ComponentManager from "./component/index";
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
import { featureSettings } from "./feature/feature-settings";
import { settingsPanel } from "./feature/impl/general/command/settings/settings-panel";
import LoggingFeature from "./feature/impl/logging";
import FeatureManager from "./feature/index";
import { env } from "./lib/env";
import { DiscordBotListManager } from "./lib/misc/discordbotlist";
import { TopbotManager } from "./lib/misc/topbot";
import { PresenceListener } from "./lib/presence";
import { formatDuration } from "./lib/time";
import { VoiceKeepaliveListener } from "./lib/voice";
import { EventVolumeListeners } from "./metrics/event-volume-listeners";
import { VictoriaMetricsExporter } from "./metrics/exporter";
import { CacheMetricsMetric } from "./metrics/impl/cache";
import { CommandCallsMetric } from "./metrics/impl/command-calls";
import { ProcessCpuUsageMetric } from "./metrics/impl/cpu-usage";
import { DiscordCacheMetric } from "./metrics/impl/discord-cache";
import { DiscordEventsMetric } from "./metrics/impl/discord-events";
import { EventLoopMetric } from "./metrics/impl/event-loop-delay";
import { GatewayLatencyMetric } from "./metrics/impl/gateway-latency";
import { GuildsMetric } from "./metrics/impl/guild-count";
import { MediaBytesMetric, MediaFilesMetric } from "./metrics/impl/media";
import { ProcessRamTotalMetric } from "./metrics/impl/process-ram-total";
import { ProcessRamUsedMetric } from "./metrics/impl/process-ram-used";
import { SeenUsersMetric } from "./metrics/impl/seen-users";
import { UptimeMetric } from "./metrics/impl/uptime-seconds";
import { MetricManager } from "./metrics/index";
import { RestListeners } from "./metrics/rest-listeners";
import PanelManager from "./panel/index";
import { PermissionsListeners } from "./permission/permissions";
import SettingsManager from "./settings/index";
import { MediaListeners } from "./storage/media-listeners";
import StorageService from "./storage/storage";

const beforeMigrate = Date.now();
await migrate(db, { migrationsFolder: "./drizzle" });
console.log(`Migrations complete in ${formatDuration(Date.now() - beforeMigrate)}`);

await StorageService.init();

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildExpressions,
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
metricManager.register(new MediaFilesMetric());
metricManager.register(new MediaBytesMetric());
metricManager.register(new CommandCallsMetric());
const discordEventsMetric = metricManager.register(new DiscordEventsMetric());
new EventVolumeListeners(discordEventsMetric);

const restListeners = new RestListeners(discordClient);
for (const metric of restListeners.metrics) {
  metricManager.register(metric);
}

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

    const commands = await this.syncCommands(client);
    console.log(`Synced ${commands.length} command(s)`);
    await EventBus.post(new PostCommandLoadEvent(client, commands));
  }

  /**
   * Push global commands, then the private ones to their guild. Returns the
   * global set so the ready handler can publish it.
   */
  private async syncCommands(client: Client): Promise<ApplicationCommandDataResolvable[]> {
    const application = client.application;
    if (!application) {
      throw new Error("Application is not available");
    }
    const commandManager = new CommandManager();
    const globalCommands = [...commandManager.buildGlobal(), ...new ContextMenuCommandManager().build()];
    await application.commands.set(globalCommands);
    CommandManager.applyApplicationCommandIds(application.commands.cache);
    await this.syncPrivateCommands(client, commandManager);
    return globalCommands;
  }

  /**
   * Register the private commands as guild commands on `PRIVATE_COMMANDS_GUILD_ID`. No-op when
   * there are none; warns when they exist but the guild is unreachable.
   */
  private async syncPrivateCommands(client: Client, commandManager: CommandManager): Promise<void> {
    const privateCommands = commandManager.buildPrivate();
    if (privateCommands.length === 0) {
      return;
    }
    const guild = env.PRIVATE_COMMANDS_GUILD_ID
      ? client.guilds.cache.get(env.PRIVATE_COMMANDS_GUILD_ID)
      : undefined;
    if (!guild) {
      console.warn(
        `Skipped ${privateCommands.length} private command(s): PRIVATE_COMMANDS_GUILD_ID is unset or the bot is not in that guild.`
      );
      return;
    }
    await guild.commands.set(privateCommands);
    CommandManager.applyApplicationCommandIds(guild.commands.cache);
    console.log(
      `Synced ${privateCommands.length} private command(s) to guild ${env.PRIVATE_COMMANDS_GUILD_ID}`
    );
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
new ComponentManager();
new SlashCommandListener();
new ContextMenuCommandListener();

new FeatureManager();
new LoggingFeature();
SettingsManager.register(featureSettings());
new MediaListeners();

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

if (env.TOPBOT_TOKEN) {
  new TopbotManager({ token: env.TOPBOT_TOKEN });
  console.log("Publishing half-hourly statistics to topbot.gg");
} else {
  console.log("TOPBOT_TOKEN not set; topbot.gg publishing is off");
}

discordClient.login(env.DISCORD_BOT_TOKEN);

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
