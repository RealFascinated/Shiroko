import Command, { type ExecuteContext } from "../../../command/command";
import { remainingMs } from "../../../lib/cooldown/cooldowns";
import { baseEmbed, ephemeralErrorReply, errorEmbed, runes } from "../../../lib/embed";
import { pluralize } from "../../../lib/format";
import { TimeUnit } from "../../../lib/time";
import { economyConfig } from "../config";
import { startEconomyCooldown } from "../cooldowns";
import { runesService } from "../runes.service";

/**
 * Claim your daily runes. Streak grows with consecutive days.
 */
export default class DailyCommand extends Command {
  constructor() {
    super("daily", "Claim your daily runes");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ globalUser, ctx, commandName }: ExecuteContext) {
    const cd = await startEconomyCooldown(globalUser.id, "daily", economyConfig.dailyCooldownMs);
    if (!cd.ok) {
      const mins = Math.ceil(remainingMs(cd.cooldown.endsAt) / TimeUnit.toMillis(TimeUnit.Minute, 1));
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `You already claimed today. Come back in ${pluralize("minute", mins)}.`
          )
        )
      );
    }

    const { amount, streak, balance } = await runesService.claimDaily(globalUser.id);
    const embed = baseEmbed(commandName)
      .setTitle("🍩 Daily Runes")
      .setDescription(`You claimed **${amount.toLocaleString()} runes**!`)
      .addFields(
        {
          name: "Streak",
          value: pluralize("day", streak).replace(/(^|\s)(\d+)/, "$1$2"),
          inline: true,
        },
        { name: "Wallet", value: runes(balance.wallet), inline: true }
      );

    return ctx.reply({ embeds: [embed] });
  }
}
