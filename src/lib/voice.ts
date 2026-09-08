import { joinVoiceChannel, type VoiceConnection } from "@discordjs/voice";
import { type Client, Events } from "discord.js";

let voiceConnection: VoiceConnection | undefined;

/**
 * Join `channelId` on `client`, logging failures instead of throwing.
 */
async function connectToVoice(client: Client, channelId: string): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
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

/**
 * Keep the bot connected to `channelId`: join on ready and rejoin whenever
 * the bot leaves the channel.
 */
export function registerVoiceKeepalive(client: Client, channelId: string): void {
  client.on(Events.VoiceStateUpdate, (_oldState, newState) => {
    if (newState.id !== client.user?.id) {
      return;
    }
    if (newState.channelId === channelId) {
      return;
    }
    void connectToVoice(client, channelId);
  });
  client.once(Events.ClientReady, readyClient => {
    void connectToVoice(readyClient, channelId);
  });
}
