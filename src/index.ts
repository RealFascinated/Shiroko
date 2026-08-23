import { Client, Events, GatewayIntentBits } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";
import { env } from "./lib/env";
import CommandManager from "./command/command-manager";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const commands = new CommandManager();

commands.registerHandlers(client);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  await commands.sync(readyClient);

  try {
    const channel = await readyClient.channels.fetch("1446633266160603268");
    if (channel?.isVoiceBased()) {
      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfMute: true,
      });
    }
  } catch (error) {
    console.error(error);
  }
});

client.login(env.DISCORD_BOT_TOKEN);
