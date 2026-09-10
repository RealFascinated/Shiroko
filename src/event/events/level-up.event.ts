import type { Guild } from "discord.js";
import { FeatureIds } from "../../feature/feature-ids";
import Event from "../event";

/**
 * A user crossed one or more level thresholds. Emitted by the levelling
 * listener after XP is granted, once per level gained, so reward granters
 * and announcements can react independently.
 */
export default class LevelUpEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly prevLevel: number;
  public readonly newLevel: number;

  constructor(options: { userId: string; guild: Guild; prevLevel: number; newLevel: number }) {
    super({
      guild: options.guild,
      userId: options.userId,
      featureId: FeatureIds.Levels,
    });
    this.userId = options.userId;
    this.guildData = options.guild;
    this.prevLevel = options.prevLevel;
    this.newLevel = options.newLevel;
  }
}
