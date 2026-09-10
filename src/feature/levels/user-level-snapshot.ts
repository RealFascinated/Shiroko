import type { XpCurve } from "./xp";

/**
 * An immutable (level, xp, curve) snapshot for a user in a guild, derived
 * fresh from `user_levels` under the guild's current curve on every read.
 * There is no stored level; the level always travels with the xp total and
 * the curve it was derived under, so a read never mixes a stale curve with
 * a fresh total.
 */
export default class UserLevelSnapshot {
  public readonly level: number;
  public readonly xp: number;
  public readonly curve: XpCurve;

  constructor(options: { level: number; xp: number; curve: XpCurve }) {
    this.level = options.level;
    this.xp = options.xp;
    this.curve = options.curve;
  }
}
