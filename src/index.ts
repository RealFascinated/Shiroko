import { Client, Events, GatewayIntentBits } from "discord.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import CommandManager from "./command";
import ContextMenuCommandManager from "./context-menu/context-menu-command-manager";
import { db } from "./db";
import FeatureManager from "./feature";
import { statsService } from "./feature/stats/stats.service";
import { env } from "./lib/env";
import { registerVoiceKeepalive } from "./lib/voice";
import Permissions from "./permission/permissions";

export { statsService };

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete");

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});

// temp (for now?)
const VOICE_CHANNEL_ID = "1446633266160603268";
registerVoiceKeepalive(discordClient, VOICE_CHANNEL_ID);

const commands = new CommandManager();
const contextMenuCommands = new ContextMenuCommandManager();
commands.registerHandlers(discordClient);
contextMenuCommands.registerHandlers(discordClient);
Permissions.registerHandlers(discordClient);

new FeatureManager();

discordClient.once(Events.ClientReady, async readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  const application = readyClient.application;
  if (!application) {
    throw new Error("Application is not available");
  }
  const allCommands = [...commands.build(), ...contextMenuCommands.build()];
  await application.commands.set(allCommands);
  console.log(`Synced ${allCommands.length} command(s)`);
});

discordClient.on(Events.GuildCreate, guild => {
  console.log(
    `Joined "${guild.name}" (${guild.memberCount} members) — now in ${discordClient.guilds.cache.size} guild(s)`
  );
});
discordClient.on(Events.GuildDelete, guild => {
  console.log(
    `Left "${guild.name}" (${guild.memberCount} members) — now in ${discordClient.guilds.cache.size} guild(s)`
  );
});

discordClient.login(env.DISCORD_BOT_TOKEN);

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
