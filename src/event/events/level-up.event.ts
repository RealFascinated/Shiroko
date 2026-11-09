import type { Guild } from "discord.js";
import Event from "../event";

/**
 * A user crossed one or more level thresholds. Emitted by the levelling
 * listener once per XP grant, spanning every level it crossed, so reward
 * granters and announcements react once rather than per level.
 */
export default class LevelUpEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly prevLevel: number;
  public readonly newLevel: number;
  // The total XP after the grant.
  public readonly xp: number;

  constructor(options: { userId: string; guild: Guild; prevLevel: number; newLevel: number; xp: number }) {
    super({
      guild: options.guild,
      userId: options.userId,
    });
    this.userId = options.userId;
    this.guildData = options.guild;
    this.prevLevel = options.prevLevel;
    this.newLevel = options.newLevel;
    this.xp = options.xp;
  }
}
