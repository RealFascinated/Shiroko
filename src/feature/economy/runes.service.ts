import { and, desc, eq, sql } from "drizzle-orm";
import { db, type DbClient } from "../../db";
import { economyTransactions, type Pocket, userEconomy } from "../../db/schema";
import { addQuestProgress } from "../quest/quests.service";
import { economyConfig } from "./config";

/**
 * Per-user rune balance. `wallet` is spendable runes; `bank` is safe runes.
 */
export interface Balance {
  userId: string;
  wallet: number;
  bank: number;
}

/**
 * Outcome of a successful daily claim: the runes awarded, the streak
 * counted for the claim, and the balance after the payout.
 */
export interface DailyClaim {
  amount: number;
  streak: number;
  balance: Balance;
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
   * Global rank of `userId` by total runes (wallet + bank), 1-based. `null`
   * for users with no economy row.
   */
  public async getGlobalRank(userId: string): Promise<number | null> {
    const [row] = await db
      .select({
        rank: sql`(
          SELECT COUNT(*) + 1
          FROM ${userEconomy} AS richer
          WHERE richer.${userEconomy.wallet} + richer.${userEconomy.bank} >
                ${userEconomy.wallet} + ${userEconomy.bank}
          AND richer.${userEconomy.userId} IS NOT NULL
        )`.mapWith(Number),
        total: sql`${userEconomy.wallet} + ${userEconomy.bank}`.mapWith(Number),
      })
      .from(userEconomy)
      .where(eq(userEconomy.userId, userId));

    return row ? row.rank : null;
  }

  /**
   * Append a row to the transaction ledger for one money flow.
   *
   * Runs against whatever db handle is passed in (`db` at the top level, the
   * transaction handle inside a `db.transaction`), so a ledger write joins
   * the same atomic commit as the balance change it describes. `kind` names
   * the flow (daily, work, beg, gamble, deposit, withdraw, pay, quest).
   */
  public async recordTransaction(
    handle: DbClient,
    fields: Omit<typeof economyTransactions.$inferInsert, "id" | "createdAt"> & { amount: number }
  ): Promise<void> {
    await handle.insert(economyTransactions).values(fields);
  }

  /**
   * The most recent `limit` ledger rows involving `userId`, newest first.
   * Rows touch the user as actor or (for payments) as target.
   */
  public async getRecentTransactions(
    userId: string,
    limit: number
  ): Promise<(typeof economyTransactions.$inferSelect)[]> {
    return db
      .select()
      .from(economyTransactions)
      .where(sql`${economyTransactions.actorId} = ${userId} OR ${economyTransactions.targetId} = ${userId}`)
      .orderBy(desc(economyTransactions.createdAt))
      .limit(limit);
  }

  /**
   * Add `amount` runes to `userId`'s `pocket` and return the new balance.
   * `kind` names the flow for the transaction ledger.
   */
  public async addMoney(
    userId: string,
    amount: number,
    pocket: Pocket,
    kind: string = "generic"
  ): Promise<Balance> {
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
      return this.addMoney(userId, amount, pocket, kind);
    }

    await this.recordTransaction(db, { actorId: userId, actorPocket: pocket, amount, kind });
    return { userId, ...row };
  }

  /**
   * Remove `amount` runes from `userId`'s `pocket`, actually reducing their
   * balance. Unlike `addMoney`/`transfer` this is a net loss, so the
   * `WHERE ... >= amount` guard means it can't take runes the user doesn't
   * have; it returns `null` (no runes moved) when the pocket is short.
   * `kind` names the flow for the transaction ledger.
   */
  public async removeMoney(userId: string, amount: number, pocket: Pocket, kind: string): Promise<Balance | null> {
    const column = pocket === "wallet" ? userEconomy.wallet : userEconomy.bank;
    const [row] = await db
      .update(userEconomy)
      .set({
        [pocket]: sql`${column} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(userEconomy.userId, userId), sql`${column} >= ${amount}`))
      .returning({ wallet: userEconomy.wallet, bank: userEconomy.bank });

    if (!row) {
      return null;
    }

    await this.recordTransaction(db, { actorId: userId, actorPocket: pocket, amount: -amount, kind });
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

    const balance = { userId, ...row };
    const kind = to === "bank" ? "deposit" : "withdraw";
    const fromPocket: Pocket = to === "bank" ? "wallet" : "bank";
    const toPocket: Pocket = to === "bank" ? "bank" : "wallet";
    await this.recordTransaction(db, {
      actorId: userId,
      actorPocket: fromPocket,
      amount: -safeAmount,
      kind,
      targetId: userId,
      targetPocket: toPocket,
    });

    if (kind === "deposit") {
      await addQuestProgress(userId, "deposit", safeAmount);
    } else {
      await addQuestProgress(userId, "withdraw", safeAmount);
    }

    return { ok: true, balance };
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

    const balance = await this.addMoney(userId, amount, "wallet", "daily");
    return { amount, streak: newStreak, balance };
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
    const wagerRow = await this.recordGambleBet(userId, wager);
    if (!wagerRow) {
      return null;
    }

    if (!win) {
      return { wallet: wagerRow, won: false, payout: 0 };
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
    await this.recordTransaction(db, {
      actorId: userId,
      actorPocket: "wallet",
      amount: payout,
      kind: "gambleWin",
    });
    await addQuestProgress(userId, "earn", payout);

    return { wallet: after?.wallet ?? wagerRow + payout, won: true, payout };
  }

  /**
   * Deduct the wager from the wallet atomically and record the loss.
   * Returns the post-bet wallet, or `null` if the user couldn't cover the bet.
   */
  private async recordGambleBet(userId: string, wager: number): Promise<number | null> {
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
    await this.recordTransaction(db, {
      actorId: userId,
      actorPocket: "wallet",
      amount: -wager,
      kind: "gamble",
    });
    await addQuestProgress(userId, "spend", wager);
    return spent.wallet;
  }

  /**
   * Send `amount` runes from `fromUserId`'s wallet to `toUserId`'s wallet,
   * taking a percentage transaction fee (see `economyConfig.payFeeRate`).
   *
   * The fee is rounded down and deducted from the sender's wallet *in
   * addition to* the sent amount, so the recipient always receives exactly
   * `amount`. Atomic: both wallet writes happen in one transaction, so a
   * payment can never partially apply. Quest progress is recorded after the
   * commit, matching the other money flows.
   *
   * Returns `null` if the sender lacks the runes; otherwise the post-payment
   * balances for both parties, the fee charged, and the amount the recipient
   * actually received.
   */
  public async pay(
    fromUserId: string,
    toUserId: string,
    amount: number
  ): Promise<{ sender: Balance; recipient: Balance; fee: number; received: number } | null> {
    const fee = Math.floor(amount * economyConfig.payFeeRate);
    const totalDebit = amount + fee;

    // Ensure the recipient has an economy row before the transaction so the
    // credit inside it always matches a row.
    await this.getBalance(toUserId);

    const result = await db.transaction(async tx => {
      const [senderRow] = await tx
        .update(userEconomy)
        .set({
          wallet: sql`${userEconomy.wallet} - ${totalDebit}`,
          updatedAt: new Date(),
        })
        .where(and(eq(userEconomy.userId, fromUserId), sql`${userEconomy.wallet} >= ${totalDebit}`))
        .returning({ wallet: userEconomy.wallet, bank: userEconomy.bank });

      if (!senderRow) {
        return null;
      }

      const [recipientRow] = await tx
        .update(userEconomy)
        .set({
          wallet: sql`${userEconomy.wallet} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(userEconomy.userId, toUserId))
        .returning({ wallet: userEconomy.wallet, bank: userEconomy.bank });

      await this.recordTransaction(tx, {
        actorId: fromUserId,
        actorPocket: "wallet",
        amount: -amount,
        kind: "pay",
        targetId: toUserId,
        targetPocket: "wallet",
      });
      await this.recordTransaction(tx, {
        actorId: fromUserId,
        actorPocket: "wallet",
        amount: -fee,
        kind: "payFee",
      });

      return {
        sender: { userId: fromUserId, ...senderRow },
        recipient: { userId: toUserId, ...recipientRow! },
        fee,
        received: amount,
      };
    });

    if (!result) {
      return null;
    }

    await addQuestProgress(fromUserId, "spend", totalDebit);
    await addQuestProgress(fromUserId, "paySomeone", amount);
    await addQuestProgress(toUserId, "earn", amount);

    return result;
  }
}

/**
 * App-wide singleton for rune money flows, created once at startup and
 * shared by every economy command.
 */
export const runesService = new RunesService();
