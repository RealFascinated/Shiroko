import DbCooldowns from "../../lib/cooldown/impl/db-cooldowns";
import { cooldownKey } from "../../lib/cooldown/key";

/**
 * Shared cooldown store for the interaction feature.
 *
 * A single instance means every `/interact <type>` subcommand enforces its
 * cooldown through one place, keyed per user via `cooldownKey`.
 *
 * Backed by Postgres so cooldowns survive restarts (and are respected across
 * multiple bot processes if the bot ever scales out).
 */
export const interactionCooldowns = new DbCooldowns();

/**
 * Attempt to start a `kind` cooldown for `userId`; convenient wrapper for
 * commands so they don't all import the store directly.
 */
export function startInteractionCooldown(userId: string, kind: string, ttlMs: number) {
  return interactionCooldowns.tryStart(cooldownKey(userId, kind), ttlMs);
}
