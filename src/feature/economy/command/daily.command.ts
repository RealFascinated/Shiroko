import Command, { type ExecuteContext } from "../../../command/command";
import { remainingMs } from "../../../lib/cooldown/cooldowns";
import { baseEmbed } from "../../../lib/embed";
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

  protected override async onExecuteSlash({ globalUser, ctx }: ExecuteContext) {
    const cd = await startEconomyCooldown(globalUser.id, "daily", economyConfig.dailyCooldownMs);
    if (!cd.ok) {
      const mins = Math.ceil(remainingMs(cd.cooldown.endsAt) / TimeUnit.toMillis(TimeUnit.Minute, 1));
      return ctx.reply(`You already claimed today. Come back in ${mins} minute${mins === 1 ? "" : "s"}.`);
    }

    const { amount, streak } = await runesService.claimDaily(globalUser.id);
    const embed = baseEmbed()
      .setTitle("Daily Runes")
      .setDescription(
        `You claimed **${amount} runes**!\nCurrent streak: **${streak} day${streak === 1 ? "" : "s"}**`
      );

    return ctx.reply({ embeds: [embed] });
  }
}
