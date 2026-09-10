import type { Guild } from "discord.js";
import { FeatureIds } from "../../feature/feature-ids";
import Event from "../event";

/**
 * A tracked member's message was recorded. Emitted by the stats listener
 * after a successful insert, carrying channel/count for progression hooks.
 */
export default class MessageRecordedEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly channelId: string;

  constructor(options: { userId: string; guild: Guild; channelId: string }) {
    super({
      guild: options.guild,
      userId: options.userId,
      featureId: FeatureIds.Stats,
    });
    this.userId = options.userId;
    this.guildData = options.guild;
    this.channelId = options.channelId;
  }
}
