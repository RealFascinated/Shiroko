import { joinVoiceChannel, VoiceConnection } from "@discordjs/voice";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import CommandManager from "./command/command-manager";
import ContextMenuCommandManager from "./context-menu/context-menu-command-manager";
import { db } from "./db";
import { runesService } from "./feature/economy/runes.service";
import { env } from "./lib/env";

export { runesService };

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete");

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const commands = new CommandManager();
commands.registerHandlers(discordClient);

const contextMenuCommands = new ContextMenuCommandManager();
contextMenuCommands.registerHandlers(discordClient);

const VOICE_CHANNEL_ID = "1446633266160603268";

let voiceConnection: VoiceConnection | undefined;

async function connectToVoice(client: Client): Promise<void> {
  try {
    const channel = await client.channels.fetch(VOICE_CHANNEL_ID);
    if (!channel?.isVoiceBased()) {
      return;
    }
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfMute: true,
    });
    if (connection !== voiceConnection) {
      voiceConnection = connection;
      connection.on("error", error => console.error("Voice connection error:", error));
    }
  } catch (error) {
    console.error("Voice connection error:", error);
  }
}

// Reconnect to the voice channel whenever the bot is no longer in it.
discordClient.on(Events.VoiceStateUpdate, (_oldState, newState) => {
  if (newState.id !== discordClient.user?.id) {
    return;
  }
  if (newState.channelId === VOICE_CHANNEL_ID) {
    return;
  }
  connectToVoice(discordClient);
});

discordClient.once(Events.ClientReady, async readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  const application = readyClient.application;
  if (!application) {
    throw new Error("Application is not available");
  }
  const allCommands = [...commands.build(), ...contextMenuCommands.build()];
  await application.commands.set(allCommands);
  console.log(`Synced ${allCommands.length} command(s)`);

  await connectToVoice(readyClient);
});

discordClient.login(env.DISCORD_BOT_TOKEN);

function shutdown(): void {
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
