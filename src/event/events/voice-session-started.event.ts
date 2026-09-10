import type { Guild } from "discord.js";
import { FeatureIds } from "../../feature/feature-ids";
import Event from "../event";

/**
 * A tracked member's voice session started (joined or moved into a
 * channel). Emitted by the stats listener.
 */
export default class VoiceSessionStartedEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly channelId: string;
  public readonly joinedAt: Date;

  constructor(options: { userId: string; guild: Guild; channelId: string; joinedAt: Date }) {
    super({
      guild: options.guild,
      userId: options.userId,
      featureId: FeatureIds.Stats,
    });
    this.userId = options.userId;
    this.guildData = options.guild;
    this.channelId = options.channelId;
    this.joinedAt = options.joinedAt;
  }
}
