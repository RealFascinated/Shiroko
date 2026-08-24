import Command, { type ExecuteContext } from "../../../command/command";
import { baseEmbed } from "../../../lib/embed";
import { runesService } from "../runes.service";

/**
 * Show your current rune balance.
 */
export default class BalanceCommand extends Command {
  constructor() {
    super("balance", "Check your rune balance");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ globalUser, ctx }: ExecuteContext) {
    const bal = await runesService.getBalance(globalUser.id);

    const embed = baseEmbed()
      .setTitle(`${globalUser.discordUser.displayName}'s Runes`)
      .setDescription(
        `**Wallet:** ${bal.wallet}\n**Bank:** ${bal.bank}\n**Total:** ${bal.wallet + bal.bank}`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
