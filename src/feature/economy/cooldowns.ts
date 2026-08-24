import DbCooldowns from "../../lib/cooldown/impl/db-cooldowns";
import { cooldownKey } from "../../lib/cooldown/key";

/**
 * Shared cooldown store for the whole economy feature.
 *
 * A single instance means `/daily`, `/beg`, and `/work` all enforce their
 * cooldowns through one place, keyed per user via `cooldownKey`.
 *
 * Backed by Postgres so cooldowns survive restarts (and are respected across
 * multiple bot processes if the bot ever scales out).
 */
export const economyCooldowns = new DbCooldowns();

/**
 * Attempt to start a `kind` cooldown for `userId`; convenient wrapper for
 * commands so they don't all import the store directly.
 */
export function startEconomyCooldown(userId: string, kind: string, ttlMs: number) {
  return economyCooldowns.tryStart(cooldownKey(userId, kind), ttlMs);
}
