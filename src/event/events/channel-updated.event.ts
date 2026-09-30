import type { NonThreadGuildBasedChannel } from "discord.js";
import Event from "../event";

/**
 * A channel or category was updated. Carries the channel before and after
 * so consumers can diff the fields they care about.
 */
export default class ChannelUpdatedEvent extends Event {
  public readonly channelId: string;
  public readonly guildData: NonThreadGuildBasedChannel["guild"];
  public readonly oldChannel: NonThreadGuildBasedChannel;
  public readonly newChannel: NonThreadGuildBasedChannel;

  constructor(oldChannel: NonThreadGuildBasedChannel, newChannel: NonThreadGuildBasedChannel) {
    super({ guild: newChannel.guild });
    this.channelId = newChannel.id;
    this.guildData = newChannel.guild;
    this.oldChannel = oldChannel;
    this.newChannel = newChannel;
  }
}
