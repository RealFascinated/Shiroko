/**
 * An immutable (level, xp) snapshot for a user in a guild, derived fresh
 * from `user_levels` on every read. There is no stored level; the level
 * always travels with the xp total.
 */
export default interface UserLevelSnapshot {
  readonly level: number;
  readonly xp: number;
}
