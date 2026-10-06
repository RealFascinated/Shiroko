import { placeholders } from "@/placeholder";
import GlobalUser from "@/user/global-user";
import { EmbedBuilder, type Guild, type GuildMember } from "discord.js";
import type { WelcomerSettingsData } from "./welcomer-settings";
import { welcomerSettings } from "./welcomer-settings";

/** An embed's title and body with every placeholder resolved. */
export interface WelcomerEmbedContent {
  title: string;
  description: string;
}

/** What a rendered message sends: an embed, or simple markdown. */
export interface WelcomerPayload {
  embeds?: EmbedBuilder[];
  content?: string;
  allowedMentions: { parse: []; users: string[] };
}

export default class WelcomerService {
  public async get(guildId: string): Promise<WelcomerSettingsData> {
    return welcomerSettings.values(guildId);
  }

  /**
   * Send the welcome message to a member who just joined. A missing
   * channel is a no-op; the feature's toggle is the only on/off switch.
   * Send failures are logged, never fatal.
   */
  public async announce(guild: Guild, member: GuildMember, globalUser: GlobalUser): Promise<void> {
    const message = await this.get(guild.id);
    if (!message.channelId) {
      return;
    }
    const channel = guild.channels.cache.get(message.channelId);
    if (!channel?.isSendable()) {
      return;
    }
    try {
      await channel.send(await this.render(guild, message, globalUser, member));
    } catch (error) {
      console.error(`Failed to send welcome message in ${guild.id}:`, error);
    }
  }

  /**
   * Resolve the embed's title and body against one user. Every distinct
   * placeholder resolves once per call.
   */
  public async resolveEmbed(
    guild: Guild,
    message: WelcomerSettingsData,
    globalUser: GlobalUser
  ): Promise<WelcomerEmbedContent> {
    const context = { globalUser, guild };
    const [title, description] = await Promise.all([
      placeholders.replace(context, message.title),
      placeholders.replace(context, message.description),
    ]);
    return { title, description };
  }

  public async resolveSimple(
    guild: Guild,
    message: WelcomerSettingsData,
    globalUser: GlobalUser
  ): Promise<string> {
    return placeholders.replace({ globalUser, guild }, message.simpleDescription);
  }

  public async render(
    guild: Guild,
    message: WelcomerSettingsData,
    globalUser: GlobalUser,
    member: GuildMember | null
  ): Promise<WelcomerPayload> {
    const allowedMentions = { parse: [] as [], users: message.ping ? [globalUser.id] : [] };
    if (message.mode === "simple") {
      return { content: await this.resolveSimple(guild, message, globalUser), allowedMentions };
    }
    const content = await this.resolveEmbed(guild, message, globalUser);
    const embed = new EmbedBuilder()
      .setColor(message.color)
      .setTitle(content.title)
      .setDescription(content.description);
    if (member) {
      embed.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() });
      embed.setThumbnail(member.user.displayAvatarURL());
    }
    embed.setTimestamp(new Date());
    return { embeds: [embed], allowedMentions };
  }

  /**
   * The message as a real embed, rendered against the user who opened the
   * panel, for the panel's preview.
   */
  public async previewEmbed(
    guild: Guild,
    message: WelcomerSettingsData,
    globalUser: GlobalUser
  ): Promise<EmbedBuilder> {
    const content = await this.resolveEmbed(guild, message, globalUser);
    return new EmbedBuilder()
      .setColor(message.color)
      .setTitle(content.title)
      .setDescription(content.description)
      .setAuthor({ name: globalUser.discordUser.tag, iconURL: globalUser.discordUser.displayAvatarURL() })
      .setThumbnail(globalUser.discordUser.displayAvatarURL())
      .setTimestamp(new Date());
  }

  /**
   * The simple message's resolved body, for the panel's preview. A simple
   * message has no embed, so there is nothing else to show.
   */
  public async previewText(
    guild: Guild,
    message: WelcomerSettingsData,
    globalUser: GlobalUser
  ): Promise<string> {
    return this.resolveSimple(guild, message, globalUser);
  }
}

export const welcomerService = new WelcomerService();
