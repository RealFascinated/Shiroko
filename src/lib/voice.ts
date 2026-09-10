import { joinVoiceChannel, type VoiceConnection } from "@discordjs/voice";
import type { Client } from "discord.js";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import BotReadyEvent from "../event/events/bot-ready.event";
import VoiceStateChangedEvent from "../event/events/voice-state-changed.event";

/**
 * Keeps the bot connected to a fixed voice channel: joins on ready and
 * rejoins whenever the bot leaves it.
 */
export class VoiceKeepaliveListener extends EventListener {
  private readonly channelId: string;
  private voiceConnection: VoiceConnection | undefined;

  constructor(channelId: string) {
    super();
    this.channelId = channelId;
    EventBus.subscribe(this);
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    await this.connectToVoice(event.client);
  }

  @EventHandler(VoiceStateChangedEvent)
  public async onVoiceStateChanged(event: VoiceStateChangedEvent): Promise<void> {
    if (event.newState.id !== event.newState.client.user?.id) {
      return;
    }
    if (event.newState.channelId === this.channelId) {
      return;
    }
    await this.connectToVoice(event.newState.client);
  }

  /**
   * Join `this.channelId` on `client`, logging failures instead of throwing.
   */
  private async connectToVoice(client: Client): Promise<void> {
    try {
      const channel = await client.channels.fetch(this.channelId);
      if (!channel?.isVoiceBased()) {
        return;
      }
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfMute: true,
      });
      if (connection !== this.voiceConnection) {
        this.voiceConnection = connection;
        connection.on("error", error => console.error("Voice connection error:", error));
      }
    } catch (error) {
      console.error("Voice connection error:", error);
    }
  }
}
