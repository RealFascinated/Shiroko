import { Client, GatewayIntentBits, type Guild } from "discord.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import CommandManager, { SlashCommandListener } from "./command";
import ContextMenuCommandManager, { ContextMenuCommandListener } from "./context-menu";
import { db } from "./db";
import EventBridge from "./event/event-bridge";
import { EventBus } from "./event/event-bus";
import { EventHandler } from "./event/event-handler";
import { EventListener } from "./event/event-listener";
import BotReadyEvent from "./event/events/bot-ready.event";
import GuildJoinedEvent from "./event/events/guild-joined.event";
import GuildLeftEvent from "./event/events/guild-left.event";
import FeatureManager from "./feature";
import { InvitesListeners } from "./feature/invites";
import { LevelsListeners } from "./feature/levels";
import { StatsListeners } from "./feature/stats";
import { env } from "./lib/env";
import { VoiceKeepaliveListener } from "./lib/voice";
import { PermissionsListeners } from "./permission/permissions";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete");

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
  }

  @EventHandler(GuildJoinedEvent)
  public async onGuildJoined(event: GuildJoinedEvent): Promise<void> {
    const client = (event.guildData as Guild & { client: Client }).client;
    console.log(
      `Joined "${event.guildData.name}" (${event.guildData.memberCount} members); now in ${client.guilds.cache.size} guild(s)`
    );
  }

  @EventHandler(GuildLeftEvent)
  public async onGuildLeft(event: GuildLeftEvent): Promise<void> {
    const client = (event.guildData as Guild & { client: Client }).client;
    console.log(
      `Left "${event.guildData.name}" (${event.guildData.memberCount} members); now in ${client.guilds.cache.size} guild(s)`
    );
  }
}

// temp (for now?)
const VOICE_CHANNEL_ID = "1446633266160603268";
new VoiceKeepaliveListener(VOICE_CHANNEL_ID);

new LifecycleListeners();
new StatsListeners();
new InvitesListeners();
new LevelsListeners();
new PermissionsListeners();
new SlashCommandListener();
new ContextMenuCommandListener();

new FeatureManager();

discordClient.login(env.DISCORD_BOT_TOKEN);

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
