import type { ApplicationCommandDataResolvable, Client, ClientApplication } from "discord.js";
import { ClusterClient, getInfo } from "discord-hybrid-sharding";
import { CacheListeners } from "./cache/cache-listeners";
import { isPrimary } from "./cluster/cluster";
import CommandManager, { SlashCommandListener } from "./command/index";
import ComponentManager from "./component/index";
import { Constants } from "./constants";
import ContextMenuCommandManager, { ContextMenuCommandListener } from "./context-menu/index";
import EventBridge from "./event/event-bridge";
import { EventBus } from "./event/event-bus";
import { EventHandler } from "./event/event-handler";
import { EventListener } from "./event/event-listener";
import BotReadyEvent from "./event/events/bot-ready.event";
import GuildJoinedEvent from "./event/events/guild-joined.event";
import GuildLeftEvent from "./event/events/guild-left.event";
import PostCommandLoadEvent from "./event/events/post-command-load.event";
import { discordClient } from "./client";
import registerFeatures from "./feature/index";
import { env } from "./lib/env";
import { DiscordBotListManager } from "./lib/misc/discordbotlist";
import { TopbotManager } from "./lib/misc/topbot";
import { TopggManager } from "./lib/misc/topgg";
import JobManager from "./jobs/index";
import { VictoriaMetricsExporter } from "./metrics/exporter";
import { MetricManager } from "./metrics/index";
import PanelManager from "./panel/index";
import { PermissionsListeners } from "./permission/permissions";
import Audit from "./audit/audit";

const clusterInfo = getInfo();
discordClient.options.shards = clusterInfo.SHARD_LIST;
discordClient.options.shardCount = clusterInfo.TOTAL_SHARDS;
discordClient.cluster = new ClusterClient(discordClient);

new EventBridge(discordClient).registerHandlers();

export const metricManager = new MetricManager(discordClient, new JobManager(discordClient));

/**
 * Guild lifecycle logging and command sync on ready. Lives here because it's
 * the entry-level wiring: the primary cluster pushes the command set to
 * Discord, the others read back the ids it registered, and join/leave is
 * logged.
 */
class LifecycleListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  /**
   * The manager spawns the next cluster only after `triggerReady`, so the
   * primary's sync lands before any other cluster reads the ids back. It runs
   * in `finally` so a failed sync can't stall the remaining clusters.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    const client = event.client;
    console.log(`Ready! Logged in as ${client.user?.tag} (cluster ${client.cluster.id})`);
    try {
      if (isPrimary(client)) {
        const commands = await this.syncCommands(client);
        console.log(`Synced ${commands.length} command(s)`);
        await EventBus.post(new PostCommandLoadEvent(client, commands));
      } else {
        await this.fetchCommandIds(client);
      }
    } finally {
      client.cluster.triggerReady();
    }
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
    const globalCommands = [...CommandManager.buildGlobal(), ...ContextMenuCommandManager.build()];
    CommandManager.applyApplicationCommandIds(await application.commands.set(globalCommands));
    await this.syncPrivateCommands(application);
    return globalCommands;
  }

  /**
   * Register the private commands as guild commands on `PRIVATE_COMMANDS_GUILD_ID`. Goes through
   * REST rather than the guild cache, since that guild may live on another cluster. No-op when
   * there are none; warns when they exist but the guild is unreachable.
   */
  private async syncPrivateCommands(application: ClientApplication): Promise<void> {
    const privateCommands = CommandManager.buildPrivate();
    if (privateCommands.length === 0) {
      return;
    }
    if (!env.PRIVATE_COMMANDS_GUILD_ID) {
      console.warn(
        `Skipped ${privateCommands.length} private command(s): PRIVATE_COMMANDS_GUILD_ID is unset.`
      );
      return;
    }
    try {
      CommandManager.applyApplicationCommandIds(
        await application.commands.set(privateCommands, env.PRIVATE_COMMANDS_GUILD_ID)
      );
      console.log(
        `Synced ${privateCommands.length} private command(s) to guild ${env.PRIVATE_COMMANDS_GUILD_ID}`
      );
    } catch (error) {
      console.warn(
        `Skipped ${privateCommands.length} private command(s): the bot cannot reach guild ${env.PRIVATE_COMMANDS_GUILD_ID}.`,
        error
      );
    }
  }

  private async fetchCommandIds(client: Client): Promise<void> {
    const application = client.application;
    if (!application) {
      throw new Error("Application is not available");
    }
    CommandManager.applyApplicationCommandIds(await application.commands.fetch());
    if (env.PRIVATE_COMMANDS_GUILD_ID && CommandManager.buildPrivate().length > 0) {
      CommandManager.applyApplicationCommandIds(
        await application.commands.fetch({ guildId: env.PRIVATE_COMMANDS_GUILD_ID })
      );
    }
  }

  @EventHandler(GuildJoinedEvent)
  public async onGuildJoined(event: GuildJoinedEvent): Promise<void> {
    const client = event.guildData.client;
    console.log(
      `Joined "${event.guildData.name}" (${event.guildData.memberCount} members); cluster ${client.cluster.id} now in ${client.guilds.cache.size} guild(s)`
    );
  }

  @EventHandler(GuildLeftEvent)
  public async onGuildLeft(event: GuildLeftEvent): Promise<void> {
    const client = event.guildData.client;
    console.log(
      `Left "${event.guildData.name}" (${event.guildData.memberCount} members); cluster ${client.cluster.id} now in ${client.guilds.cache.size} guild(s)`
    );
  }
}

new LifecycleListeners();
new PermissionsListeners();
new CacheListeners();
new PanelManager();
new ComponentManager();
new ContextMenuCommandManager();
new SlashCommandListener(metricManager.commandDuration, metricManager.commandErrors);
new ContextMenuCommandListener(metricManager.commandDuration, metricManager.commandErrors);

registerFeatures();
new Audit();

if (env.VM_PUSH_URL) {
  const exporter = new VictoriaMetricsExporter(metricManager, {
    url: env.VM_PUSH_URL,
    labels: { job: Constants.botName, cluster: String(discordClient.cluster.id) },
    intervalMs: Number(env.VM_PUSH_INTERVAL_MS ?? 60_000),
  });
  exporter.start();
  console.log(
    `Pushing metrics to VictoriaMetrics at ${env.VM_PUSH_URL} every ${Number(env.VM_PUSH_INTERVAL_MS ?? 60_000) / 1000}s`
  );
} else {
  console.log("VM_PUSH_URL not set; metrics collection is on, push is off");
}

// The bot-wide totals are the same from every cluster, so one publisher is enough.
if (isPrimary(discordClient)) {
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

  if (env.TOPGG_TOKEN) {
    new TopggManager({ token: env.TOPGG_TOKEN });
    console.log("Publishing half-hourly statistics to top.gg");
  } else {
    console.log("TOPGG_TOKEN not set; top.gg publishing is off");
  }
}

discordClient.login(env.DISCORD_BOT_TOKEN);

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
