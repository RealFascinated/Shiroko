import { Client, Events, GatewayIntentBits } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { env } from "./lib/env";
import { db } from "./db";
import CommandManager from "./command/command-manager";
import ContextMenuCommandManager from "./context-menu/context-menu-command-manager";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete");

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const commands = new CommandManager();
commands.registerHandlers(discordClient);

const contextMenuCommands = new ContextMenuCommandManager();
contextMenuCommands.registerHandlers(discordClient);

discordClient.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  const application = readyClient.application;
  if (!application) {
    throw new Error("Application is not available");
  }
  const allCommands = [...commands.build(), ...contextMenuCommands.build()];
  await application.commands.set(allCommands);
  console.log(`Synced ${allCommands.length} command(s)`);

  try {
    const channel = await readyClient.channels.fetch("1446633266160603268");
    if (channel?.isVoiceBased()) {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfMute: true,
      });
      connection.on("error", (error) => console.error("Voice connection error:", error));
    }
  } catch (error) {
    console.error(error);
  }
});

discordClient.login(env.DISCORD_BOT_TOKEN);

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
