import Command, { type ExecuteContext } from "../../../command/command";
import { integerOption, userOption } from "../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed, runes } from "../../../lib/embed";
import GlobalUsersManager from "../../../user/global-users-manager";
import { economyConfig } from "../config";
import { runesService } from "../runes.service";

/**
 * Send runes from your wallet to another student's wallet. A 5% fee is
 * taken from your wallet on top of the sent amount, so they always receive
 * exactly what you send.
 */
export default class PayCommand extends Command {
  constructor() {
    super("pay", "Send runes to another user");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [
      userOption(true, "user", "Who to pay"),
      integerOption(true, "amount", "How many runes to send", economyConfig.payMinAmount),
    ];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("user")!;
    if (target.id === globalUser.id) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("You can't pay yourself, that's just moving runes around.")
        )
      );
    }

    const amount = args.integer("amount") ?? 0;
    if (amount < economyConfig.payMinAmount) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `You can't send less than ${economyConfig.payMinAmount} rune.`
          )
        )
      );
    }

    const fee = Math.floor(amount * economyConfig.payFeeRate);
    const result = await runesService.pay(globalUser.id, target.id, amount);
    if (!result) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `You don't have enough runes in your wallet for that (${runes(amount + fee)} total with the fee).`
          )
        )
      );
    }

    // Ensure the recipient's global user row exists so mentions and quests
    // resolve for them (the economy row is created inside `pay`).
    await GlobalUsersManager.getUser(target);

    const embed = baseEmbed(commandName)
      .setTitle("💰 Payment")
      .setDescription(`**${globalUser.discordUser}** paid **${target}** ${runes(result.received)}.`)
      .addFields(
        { name: "Fee", value: runes(result.fee), inline: true },
        { name: "You", value: runes(result.sender.wallet), inline: true },
        { name: "Them", value: runes(result.recipient.wallet), inline: true }
      );
    return ctx.reply({ embeds: [embed] });
  }
}
