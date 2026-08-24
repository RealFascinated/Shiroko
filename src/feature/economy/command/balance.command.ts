import Command, { type ExecuteContext } from "../../../command/command";
import { userOption } from "../../../command/option";
import { baseEmbed, runes } from "../../../lib/embed";
import GlobalUsersManager from "../../../user/global-users-manager";
import { runesService } from "../runes.service";

/**
 * Show your current rune balance, or another user's.
 */
export default class BalanceCommand extends Command {
  constructor() {
    super("balance", "Check your rune balance");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [userOption(false, "user", "Whose balance to check (defaults to you)")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("user") ?? globalUser.discordUser;
    if (target.id === globalUser.id) {
      const bal = await runesService.getBalance(globalUser.id);

      const embed = baseEmbed(commandName)
        .setTitle("💰 Balance")
        .setDescription(`You hold **${(bal.wallet + bal.bank).toLocaleString()} runes**.`)
        .addFields(
          { name: "Wallet", value: runes(bal.wallet), inline: true },
          { name: "Bank", value: runes(bal.bank), inline: true }
        );
      return ctx.reply({ embeds: [embed] });
    }

    const targetGlobal = await GlobalUsersManager.getUser(target);
    const bal = await runesService.getBalance(targetGlobal.id);

    const embed = baseEmbed(commandName)
      .setTitle(`💰 ${target.displayName}'s Balance`)
      .setDescription(
        `**${target.displayName}** holds **${(bal.wallet + bal.bank).toLocaleString()} runes**.`
      )
      .addFields(
        { name: "Wallet", value: runes(bal.wallet), inline: true },
        { name: "Bank", value: runes(bal.bank), inline: true }
      );
    return ctx.reply({ embeds: [embed] });
  }
}
