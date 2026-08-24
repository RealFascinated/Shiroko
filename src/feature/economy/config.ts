import { TimeUnit } from "../../lib/time";

/** A part-time job with a fixed payout. */
export interface FlatWorkJob {
  kind: "flat";
  label: string;
  pay: number;
}

/** A part-time job with a random payout range and an optional bonus. */
export interface VariableWorkJob {
  kind: "variable";
  label: string;
  pay: [number, number];
  bonus?: { chance: number; amount: number };
}

/** Any part-time job available at the Summit. */
export type WorkJob = FlatWorkJob | VariableWorkJob;

/**
 * Tuning knobs for the rune economy. Values are initial guesses — tweak
 * here and restart to rebalance without redeploying.
 */
export const economyConfig = {
  /** Base /daily payout in runes, before streak bonus. */
  dailyBase: 200,
  /** Runes added to the daily payout per consecutive day claimed. */
  dailyStreakBonus: 5,
  /** Maximum streak bonus that can apply to a daily payout. */
  dailyStreakCap: 50,
  /** Cooldown for claiming /daily, in milliseconds. */
  dailyCooldownMs: TimeUnit.toMillis(TimeUnit.Day, 1),
  /**
   * Oldest a last-claim can be and still count toward a streak. If a user
   * claims more than this long after their last claim, the streak resets.
   */
  dailyStreakWindowMs: TimeUnit.toMillis(TimeUnit.Day, 2),
  /** Cooldown for /beg, in milliseconds. */
  begCooldownMs: TimeUnit.toMillis(TimeUnit.Second, 45),
  /** Cooldown for /work, in milliseconds. */
  workCooldownMs: TimeUnit.toMillis(TimeUnit.Minute, 45),
  /** Part-time jobs at the Summit, keyed by the /work subcommand name. */
  workJobs: {
    security: { kind: "flat", label: "Summit security", pay: 60 },
    vending: { kind: "flat", label: "Vending machine restock", pay: 80 },
    soda: { kind: "flat", label: "Soda runner", pay: 80 },
    intern: {
      kind: "variable",
      label: "Foreclosure Office intern",
      pay: [5, 15],
      bonus: { chance: 0.15, amount: 150 },
    },
    barista: { kind: "flat", label: "Boba barista", pay: 70 },
    gacha: {
      kind: "variable",
      label: "Gacha machine restock",
      pay: [10, 30],
      bonus: { chance: 0.1, amount: 200 },
    },
    janitor: { kind: "flat", label: "Summit janitor", pay: 50 },
    delivery: { kind: "flat", label: "Food court delivery", pay: 100 },
  } as Record<string, WorkJob>,
  /** Maximum wager for /gamble. */
  gambleMaxWager: 25_000,
  /** Multiplier applied to a winning 4x bet. */
  gambleQuadruplePayout: 3.5,
  /** Multiplier applied to a winning 1.5x bet. */
  gambleLowPayout: 1.4,
  /** Maximum runes moved per bank deposit/withdraw action. */
  bankTransferCap: 10_000,
};
