import { MessageFlags } from "discord.js";
import Command, { type ExecuteContext } from "../../../command/command";
import { remainingMs } from "../../../lib/cooldown/cooldowns";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../lib/embed";
import { randInt, randIntRange } from "../../../lib/math";
import { TimeUnit } from "../../../lib/time";
import { pluralize } from "../../../lib/utils";
import { economyConfig } from "../config";
import { startEconomyCooldown } from "../cooldowns";
import { runesService } from "../runes.service";

const PATRONS = [
  {
    name: "Arona",
    chance: 0.5,
    range: [1, 20],
    says: (amt: number) => `hands you ${amt} runes. "That's all I had... go buy a soda or something."`,
  },
  {
    name: "Hifumi",
    chance: 0.05,
    range: [100, 500],
    says: (amt: number) => `grins and hands you ${amt} runes. "Don't tell anyone, okay?"`,
  },
  {
    name: "Sora",
    chance: 0.4,
    range: [1, 20],
    says: (amt: number) => `counts out ${amt} runes. "The General Shop appreciates your patronage."`,
  },
  {
    name: "Arisu",
    chance: 0.05,
    range: [1, 20],
    says: (amt: number) => `gives you ${amt} runes. "This is a state-of-the-art... coin? Probably."`,
  },
] as const;

/**
 * Beg for runes from a rotating cast of Blue Archive patrons. Low reward,
 * high flavor, and occasionally the inner Blade robs you.
 */
export default class BegCommand extends Command {
  constructor() {
    super("beg", "Beg for runes");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ globalUser, ctx, commandName }: ExecuteContext) {
    const cd = await startEconomyCooldown(globalUser.id, "beg", economyConfig.begCooldownMs);
    if (!cd.ok) {
      const secs = Math.ceil(remainingMs(cd.cooldown.endsAt) / TimeUnit.toMillis(TimeUnit.Second, 1));
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `You're begging too fast. Wait ${pluralize("second", secs)}.`
          )
        )
      );
    }

    const roll = Math.random();

    // Arona's moody side strikes: small loss.
    if (roll < 0.15) {
      const loss = randInt(1, 4);
      const result = await runesService.transfer(globalUser.id, loss, "bank", loss);
      if (!result.ok) {
        return ctx.reply({
          content:
            "Arona's moody side eyed you, but you have nothing to lose... and nothing to give. You walk away shaken.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const embed = baseEmbed(commandName)
        .setTitle("💸 Beg")
        .setDescription(
          `You begged, but Arona's moody side stirs and snatches **${loss} runes** from your wallet.\n\n*"Don't tell her."*`
        );
      return ctx.reply({ embeds: [embed] });
    }

    // Someone is home: pick a patron.
    const patrons = PATRONS.filter(p => p.chance > 0);
    let remaining = Math.random();
    let patron = patrons[0];
    for (const p of patrons) {
      remaining -= p.chance;
      if (remaining <= 0) {
        patron = p;
        break;
      }
    }
    if (!patron) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No one is home right now. Try again later.")
        )
      );
    }

    const amount = randIntRange(patron.range);
    await runesService.addMoney(globalUser.id, amount, "wallet");

    const embed = baseEmbed(commandName)
      .setTitle("💸 Beg")
      .setDescription(`You beg, and **${patron.name}** answers.\n\n*${patron.says(amount)}*`);
    return ctx.reply({ embeds: [embed] });
  }
}
