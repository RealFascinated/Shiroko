import Command, { type ExecuteContext } from "../../../command/command";
import { stringOption } from "../../../command/option";
import { baseEmbed } from "../../../lib/embed";
import { economyConfig } from "../config";
import { runesService } from "../runes.service";

/**
 * Move runes between your wallet and your bank. Banked runes are safe from
 * whatever the economy throws at you; a cap applies per transfer.
 */
export default class BankCommand extends Command {
  constructor() {
    super("bank", "Deposit or withdraw runes");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx }: ExecuteContext) {
    return ctx.reply("Choose a subcommand: /bank deposit <amount> or /bank withdraw <amount>");
  }
}

/**
 * Deposit part of your wallet into your bank (capped per action).
 */
export class BankDepositCommand extends Command {
  constructor() {
    super("deposit", "Move runes from your wallet to your bank");
  }

  public override get options() {
    return [stringOption(true, "amount", "How many runes to deposit (or 'all' / 'half')")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const amountRaw = args.string("amount")!;
    const bal = await runesService.getBalance(globalUser.id);

    const amount = resolveAmount(amountRaw, bal.wallet);
    if (amount === null) {
      return ctx.reply("Say a number, or `all` / `half`.");
    }
    if (amount <= 0) {
      return ctx.reply("You have nothing to deposit.");
    }

    const result = await runesService.transfer(globalUser.id, amount, "bank", economyConfig.bankTransferCap);
    if (!result.ok) {
      return ctx.reply("You don't have enough runes in your wallet for that.");
    }

    const embed = baseEmbed()
      .setTitle("Bank Deposit")
      .setDescription(
        `Deposited **${amount} runes**.\nWallet: **${result.balance.wallet}** · Bank: **${result.balance.bank}**`
      );
    return ctx.reply({ embeds: [embed] });
  }
}

/**
 * Withdraw part of your bank back into your wallet (capped per action).
 */
export class BankWithdrawCommand extends Command {
  constructor() {
    super("withdraw", "Move runes from your bank to your wallet");
  }

  public override get options() {
    return [stringOption(true, "amount", "How many runes to withdraw (or 'all' / 'half')")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const amountRaw = args.string("amount")!;
    const bal = await runesService.getBalance(globalUser.id);

    const amount = resolveAmount(amountRaw, bal.bank);
    if (amount === null) {
      return ctx.reply("Say a number, or `all` / `half`.");
    }
    if (amount <= 0) {
      return ctx.reply("Your bank is empty.");
    }

    const result = await runesService.transfer(
      globalUser.id,
      amount,
      "wallet",
      economyConfig.bankTransferCap
    );
    if (!result.ok) {
      return ctx.reply("You don't have enough runes in your bank for that.");
    }

    const embed = baseEmbed()
      .setTitle("Bank Withdraw")
      .setDescription(
        `Withdrew **${amount} runes**.\nWallet: **${result.balance.wallet}** · Bank: **${result.balance.bank}**`
      );
    return ctx.reply({ embeds: [embed] });
  }
}

/**
 * Parse a user-supplied amount: `all`, `half`, or a numeric string.
 *
 * Returns `null` for invalid input and clamps `all`/`half` to what's
 * available.
 */
function resolveAmount(raw: string, available: number): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "all") {
    return available;
  }
  if (trimmed === "half") {
    return Math.floor(available / 2);
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.floor(n);
}
