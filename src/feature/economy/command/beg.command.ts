import { MessageFlags } from "discord.js";
import Command, { type ExecuteContext } from "../../../command/command";
import { remainingMs } from "../../../lib/cooldown/cooldowns";
import { baseEmbed, ephemeralErrorReply, errorEmbed, runes } from "../../../lib/embed";
import { randInt, randIntRange } from "../../../lib/math";
import { formatDuration } from "../../../lib/time";
import { economyConfig } from "../config";
import { startEconomyCooldown } from "../cooldowns";
import { runesService } from "../runes.service";

const PATRONS = [
  {
    name: "Arona",
    chance: 0.25,
    range: [1, 20],
    line: `hands over the runes. "That's all I had... go buy a soda or something."`,
  },
  {
    name: "Sora",
    chance: 0.2,
    range: [1, 20],
    line: `counts out the runes with great ceremony. "The General Shop appreciates your patronage."`,
  },
  {
    name: "Arisu",
    chance: 0.13,
    range: [1, 20],
    line: `hands over the runes. "This is a state-of-the-art... coin? Probably."`,
  },
  {
    name: "Chizuru",
    chance: 0.12,
    range: [15, 45],
    line: `adjusts her glasses and hands over a neat little stack. "The Countermeasures Council's budget approves this. Barely."`,
  },
  {
    name: "Hoshino",
    chance: 0.12,
    range: [15, 45],
    line: `hands them over quietly. "...Don't tell anyone I did this, okay?"`,
  },
  {
    name: "Miyabi",
    chance: 0.08,
    range: [20, 80],
    line: `tosses you a handful of coins with a lazy grin. "You won my little game. Consider it your winnings."`,
  },
  {
    name: "Ayane",
    chance: 0.05,
    range: [100, 250],
    line: `flips you a wad of cash without breaking eye contact. "Don't get used to it."`,
  },
  {
    name: "Hifumi",
    chance: 0.05,
    range: [50, 150],
    line: `grins and slips you a fat handful. "Don't tell anyone, okay?"`,
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
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `You're begging too fast. Come back in ${formatDuration(remainingMs(cd.cooldown.endsAt))}.`
          )
        )
      );
    }

    const roll = Math.random();

    // Arona's moody side strikes: small loss.
    if (roll < 0.15) {
      const loss = randInt(1, 4);
      const result = await runesService.removeMoney(globalUser.id, loss, "wallet", "begLoss");
      if (!result) {
        return ctx.reply({
          content:
            "Arona's moody side eyed you, but you have nothing to lose... and nothing to give. You walk away shaken.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const embed = baseEmbed(commandName)
        .setTitle("💸 Beg")
        .setDescription(
          `You begged, but Arona's moody side stirs and snatches **${loss} runes** from your wallet.\n${runes(
            result.wallet
          )} in your wallet.\n\n*"Don't tell her."*`
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
    const balance = await runesService.addMoney(globalUser.id, amount, "wallet", "beg");

    const embed = baseEmbed(commandName)
      .setTitle("💸 Beg")
      .setDescription(
        `You begged, and **${patron.name}** handed you **${amount} runes**.\n${runes(
          balance.wallet
        )} in your wallet.\n\n*${patron.line}*`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
