import { TimeUnit } from "../../lib/time";

/**
 * Tuning knobs for the interaction feature. Values are initial guesses —
 * tweak here and restart to rebalance without redeploying.
 */
export const interactionConfig = {
  /** Window, in milliseconds, during which a "… back!" button can be used. */
  backButtonWindowMs: TimeUnit.toMillis(TimeUnit.Minute, 1),
  /** Cooldown for returning an interaction via a "… back!" button, per user per type. */
  backButtonCooldownMs: TimeUnit.toMillis(TimeUnit.Minute, 5),
};
