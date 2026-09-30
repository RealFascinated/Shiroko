import type { NonThreadGuildBasedChannel } from "discord.js";
import Event from "../event";

/**
 * A channel or category was created in a guild. Carries the new channel
 * and its guild.
 */
export default class ChannelCreatedEvent extends Event {
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
