import type { NonThreadGuildBasedChannel } from "discord.js";
import Event from "../event";

/**
 * A channel or category was deleted from a guild. Carries the deleted
 * channel and its guild.
 */
export default class ChannelDeletedEvent extends Event {
  public readonly channelId: string;
  public readonly channel: NonThreadGuildBasedChannel;
  public readonly guildData: NonThreadGuildBasedChannel["guild"];

  constructor(channel: NonThreadGuildBasedChannel) {
    super({ guild: channel.guild });
    this.channelId = channel.id;
    this.channel = channel;
    this.guildData = channel.guild;
  }
}
