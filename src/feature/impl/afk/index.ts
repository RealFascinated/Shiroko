import { EventHandler } from "@/event/event-handler";
import BotReadyEvent from "@/event/events/bot-ready.event";
import MessageCreatedEvent from "@/event/events/message-created.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import type { Message } from "discord.js";
import AfkCommand from "./command/afk.command";
import { afkNotice, welcomeBack } from "./afk-text";
import { afkService } from "./afk.service";

/**
 * `/afk` plus the message listener: speaking clears your AFK, and mentioning
 * someone who is away gets a reply saying so.
 */
export default class AfkFeature extends Feature {
  constructor() {
    super(FeatureIds.Afk, { name: "AFK", emoji: "💤" });
    this.registerCommand(new AfkCommand());
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(): Promise<void> {
    await afkService.load();
  }

  @EventHandler(MessageCreatedEvent, { featureId: FeatureIds.Afk })
  public async onMessageCreated({ message }: MessageCreatedEvent): Promise<void> {
    const { guild, author } = message;
    if (!guild) {
      return;
    }
    const returned = await afkService.clear(guild.id, author.id);
    if (returned) {
      await this.say(message, welcomeBack(message.member?.displayName ?? author.displayName, returned));
    }
    const away = [...message.mentions.users.values()].flatMap(mentioned => {
      const state = afkService.get(guild.id, mentioned.id);
      const name = message.mentions.members?.get(mentioned.id)?.displayName ?? mentioned.displayName;
      return mentioned.id !== author.id &&
        state &&
        afkService.claimNotice(guild.id, mentioned.id, message.channelId)
        ? [{ name, state }]
        : [];
    });
    if (away.length > 0) {
      await this.say(message, afkNotice(away));
    }
  }

  // Replies fail in channels the bot cannot speak in, which is not worth surfacing.
  private async say(message: Message, content: string): Promise<void> {
    await message
      .reply({ content, allowedMentions: { parse: [], repliedUser: false } })
      .catch(() => undefined);
  }
}
