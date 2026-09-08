import { Client, Events, GatewayIntentBits } from "discord.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import CommandManager from "./command/command-manager";
import ContextMenuCommandManager from "./context-menu/context-menu-command-manager";
import { db } from "./db";
import { statsService } from "./feature/stats/stats.service";
import { env } from "./lib/env";
import { registerVoiceKeepalive } from "./lib/voice";

export { statsService };

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete");

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages],
});

const commands = new CommandManager();
commands.registerHandlers(discordClient);

const contextMenuCommands = new ContextMenuCommandManager();
contextMenuCommands.registerHandlers(discordClient);

const VOICE_CHANNEL_ID = "1446633266160603268";

statsService.registerHandlers(discordClient);
registerVoiceKeepalive(discordClient, VOICE_CHANNEL_ID);

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

discordClient.login(env.DISCORD_BOT_TOKEN);

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
