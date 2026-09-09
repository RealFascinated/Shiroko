import { Events } from "discord.js";
import Feature, { FeatureIds } from "../feature";
import { statsService } from "./stats.service";

export default class StatsFeature extends Feature {
  constructor() {
    super(FeatureIds.Stats);

    this.registerEventListener(Events.MessageCreate, message => {
      if (message.author.bot || message.webhookId) {
        return;
      }
      if (!message.guildId) {
        return;
      }
      statsService
        .recordMessage({
          id: message.id,
          userId: message.author.id,
          guildId: message.guildId,
          channelId: message.channelId,
          createdAt: message.createdAt,
        })
        .catch(error => console.error("Message stats error:", error));
    });
    this.registerEventListener(Events.VoiceStateUpdate, (oldState, newState) => {
      if (newState.id === newState.client.user?.id) {
        return;
      }
      const user = newState.member?.user ?? oldState.member?.user;
      if (user?.bot) {
        return;
      }
      statsService
        .trackVoiceState(newState.id, newState.guild.id, oldState.channelId, newState.channelId)
        .catch(error => console.error("Voice stats error:", error));
    });
    this.registerEventListener(Events.ClientReady, readyClient => {
      void statsService.recoverOpenSessions(readyClient);
    });
  }
}
