import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { userEconomy } from "../../db/schema";
import { economyConfig } from "./config";

/**
 * Per-user rune balance. `wallet` is spendable runes; `bank` is safe runes.
 */
export interface Balance {
  userId: string;
  wallet: number;
  bank: number;
}

/** A pocket runes can be held in — the spendable wallet or the safe bank. */
export type Pocket = "wallet" | "bank";

/**
 * Outcome of a successful daily claim: the runes awarded and the streak
 * counted for the claim.
 */
export interface DailyClaim {
  amount: number;
  streak: number;
}

/**
 * Result of a resolved gamble: the wallet after the bet settled, whether it
 * was a win, and the runes paid out on a win (0 on a loss).
 */
export interface GambleResult {
  wallet: number;
  won: boolean;
  payout: number;
}

/**
 * Outcome of a rune transfer between wallet and bank.
 *
 * `ok` is `false` if the operation hit a cap or had insufficient runes in
 * the source pocket (the transfer was rejected and no runes moved). When
 * `ok` is `true`, `balance` is the post-transfer balance.
 */
export interface TransferResult {
  ok: boolean;
  balance: Balance;
}

/**
 * Every money flow in the economy. All writes are atomic `UPDATE ... SET x =
 * x +/- n` statements so two commands can't race to a negative balance.
 */
export default class RunesService {
  /**
   * Return `userId`'s balance, creating the row if it doesn't exist yet.
   */
  public async getBalance(userId: string): Promise<Balance> {
    const [existing] = await db
      .select({ wallet: userEconomy.wallet, bank: userEconomy.bank })
      .from(userEconomy)
      .where(eq(userEconomy.userId, userId));

    if (existing) {
      return { userId, ...existing };
    }

    const [inserted] = await db
      .insert(userEconomy)
      .values({ userId, wallet: 0, bank: 0 })
      .onConflictDoNothing({ target: userEconomy.userId })
      .returning({ wallet: userEconomy.wallet, bank: userEconomy.bank });

    if (!inserted) {
      return this.getBalance(userId);
    }

    return { userId, ...inserted };
  }

  /**
   * Add `amount` runes to `userId`'s `pocket` and return the new balance.
   */
  public async addMoney(userId: string, amount: number, pocket: Pocket): Promise<Balance> {
    const column = pocket === "wallet" ? userEconomy.wallet : userEconomy.bank;
    const [row] = await db
      .update(userEconomy)
      .set({
        [pocket]: sql`${column} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userEconomy.userId, userId))
      .returning({ wallet: userEconomy.wallet, bank: userEconomy.bank });

    if (!row) {
      await this.getBalance(userId);
      return this.addMoney(userId, amount, pocket);
    }

    return { userId, ...row };
  }

  /**
   * Move `amount` runes from one pocket to the other.
   *
   * The source pocket is decremented with a `WHERE ... >= amount` guard so a
   * transfer can never go negative. Caps the transfer at `cap` and returns
   * `ok: false` if the source doesn't have enough.
   */
  public async transfer(userId: string, amount: number, to: Pocket, cap: number): Promise<TransferResult> {
    const safeAmount = Math.min(amount, cap);
    const from = to === "wallet" ? userEconomy.bank : userEconomy.wallet;
    const toColumn = to === "wallet" ? userEconomy.wallet : userEconomy.bank;

    const [row] = await db
      .update(userEconomy)
      .set({
        [from.name]: sql`${from} - ${safeAmount}`,
        [toColumn.name]: sql`${toColumn} + ${safeAmount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(userEconomy.userId, userId), sql`${from} >= ${safeAmount}`))
      .returning({ wallet: userEconomy.wallet, bank: userEconomy.bank });

    if (!row) {
      return { ok: false, balance: await this.getBalance(userId) };
    }

    return { ok: true, balance: { userId, ...row } };
  }

  /**
   * Claim `userId`'s daily runes and update their streak.
   *
   * If the user's last claim is older than the streak window, the streak
   * resets to 1. The payout is `dailyBase + min(dailyStreakBonus * streak,
   * dailyStreakCap)`, always at least the base.
   *
   * The 24h *cooldown* itself is enforced by the shared cooldown lib (see
   * the daily command), so this method only tracks the claim timing used to
   * compute the streak.
   */
  public async claimDaily(userId: string): Promise<DailyClaim> {
    const [existing] = await db
      .select({
        wallet: userEconomy.wallet,
        bank: userEconomy.bank,
        streak: userEconomy.streak,
        lastClaimed: userEconomy.lastClaimed,
      })
      .from(userEconomy)
      .where(eq(userEconomy.userId, userId));

    const nowTs = Date.now();
    const keepStreak =
      !!existing && nowTs - existing.lastClaimed.getTime() <= economyConfig.dailyStreakWindowMs;
    const newStreak = (keepStreak ? existing.streak : 0) + 1;

    const [row] = await db
      .update(userEconomy)
      .set({
        streak: newStreak,
        lastClaimed: new Date(nowTs),
        updatedAt: new Date(),
      })
      .where(eq(userEconomy.userId, userId))
      .returning({ extra: sql`1` });

    if (!row) {
      await this.getBalance(userId);
      return this.claimDaily(userId);
    }

    const bonus = Math.min(
      economyConfig.dailyStreakBonus * Math.max(0, newStreak - 1),
      economyConfig.dailyStreakCap
    );
    const amount = economyConfig.dailyBase + bonus;

    await this.addMoney(userId, amount, "wallet");
    return { amount, streak: newStreak };
  }

  /**
   * Attempt a `wager`-rune bet that pays `multiplier`-fold on a win.
   *
   * If the wager is valid and the user has enough runes, the wallet is
   * decremented atomically (returning `null` if it lacks the runes). On a
   * win the payout (wager * multiplier) is added; on a loss nothing is.
   */
  public async gamble(
    userId: string,
    wager: number,
    multiplier: number,
    win: boolean
  ): Promise<GambleResult | null> {
    const [spent] = await db
      .update(userEconomy)
      .set({
        wallet: sql`${userEconomy.wallet} - ${wager}`,
        updatedAt: new Date(),
      })
      .where(and(eq(userEconomy.userId, userId), sql`${userEconomy.wallet} >= ${wager}`))
      .returning({ wallet: userEconomy.wallet });

    if (!spent) {
      return null;
    }

    if (!win) {
      return { wallet: spent.wallet, won: false, payout: 0 };
    }

    const payout = Math.round(wager * multiplier);
    const [after] = await db
      .update(userEconomy)
      .set({
        wallet: sql`${userEconomy.wallet} + ${payout}`,
        updatedAt: new Date(),
      })
      .where(eq(userEconomy.userId, userId))
      .returning({ wallet: userEconomy.wallet });

    return { wallet: after?.wallet ?? spent.wallet + payout, won: true, payout };
  }
}

/**
 * App-wide singleton for rune money flows, created once at startup and
 * shared by every economy command.
 */
export const runesService = new RunesService();
