import { Client, Events, GatewayIntentBits } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { env } from "./lib/env";
import { db } from "./db";
import CommandManager from "./command/command-manager";
import AppCommandManager from "./command/app-command-manager";
import AvatarCommand from "./feature/interaction/command/app/avatar.command";
import GlobalUsersManager from "./user/global-users-manager";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete");

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

new GlobalUsersManager();

const commands = new CommandManager();
commands.registerHandlers(discordClient);

const appCommands = new AppCommandManager();
appCommands.registerHandlers(discordClient);

discordClient.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  await commands.sync(readyClient);
  await appCommands.sync(readyClient);

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

async function shutdown(): Promise<void> {
  console.log("Shutting down — saving accounts and profiles...");
  await GlobalUsersManager.saveAllProfiles();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
