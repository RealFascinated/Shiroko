import type { Guild } from "discord.js";
import { FeatureIds } from "../../feature/feature-ids";
import Event from "../event";

/**
 * A tracked member's voice session ended (left or moved away). Emitted by
 * the stats listener.
 */
export default class VoiceSessionEndedEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly channelId: string | null;
  public readonly joinedAt: Date;
  public readonly leftAt: Date;

  constructor(options: {
    userId: string;
    guild: Guild;
    channelId: string | null;
    joinedAt: Date;
    leftAt: Date;
  }) {
    super({
      guild: options.guild,
      userId: options.userId,
      featureId: FeatureIds.Stats,
    });
    this.userId = options.userId;
    this.guildData = options.guild;
    this.channelId = options.channelId;
    this.joinedAt = options.joinedAt;
    this.leftAt = options.leftAt;
  }
}
