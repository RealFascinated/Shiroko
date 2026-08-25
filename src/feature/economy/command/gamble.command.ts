import Command, { type ExecuteContext } from "../../../command/command";
import { integerOption, stringOption } from "../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed, runes } from "../../../lib/embed";
import { economyConfig } from "../config";
import { runesService } from "../runes.service";

/**
 * Wager runes on one of three games. Every game has a small house edge so
 * the economy doesn't inflate.
 */
export default class GambleCommand extends Command {
  constructor() {
    super("gamble", "Wager runes on a game of chance");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [
      integerOption(true, "amount", "How many runes to wager", {
        minValue: 1,
        maxValue: economyConfig.gambleMaxWager,
      }),
      stringOption(true, "game", "Which game to play", {
        choices: {
          "2x": "Double or Nothing (coin flip)",
          "4x": "Quadruple or Bust (pick 1-8)",
          "1.5x": "Low risk (pet the Arona)",
        },
      }),
      stringOption(false, "pick", "Heads/Tails for 2x, or a number 1-8 for 4x"),
    ];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args, commandName }: ExecuteContext) {
    const amount = args.integer("amount")!;
    if (amount < 1 || amount > economyConfig.gambleMaxWager) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(`Wager a number from 1 to ${economyConfig.gambleMaxWager}.`)
        )
      );
    }

    const game = args.string("game")!;
    const pick = args.string("pick");

    let win: boolean;
    let multiplier: number;
    let outcomeLine: string;

    switch (game) {
      case "2x": {
        const chosen = (pick ?? "heads").toLowerCase();
        if (chosen !== "heads" && chosen !== "tails") {
          return ctx.reply(
            ephemeralErrorReply(
              commandName,
              errorEmbed(commandName).setDescription("Pick `heads` or `tails` for Double or Nothing.")
            )
          );
        }
        win = Math.random() < 0.5;
        multiplier = 2;
        outcomeLine = `The coin lands **${win ? chosen : chosen === "heads" ? "tails" : "heads"}**.`;
        break;
      }
      case "4x": {
        const chosen = pick ? parseInt(pick, 10) : NaN;
        if (!Number.isInteger(chosen) || chosen < 1 || chosen > 8) {
          return ctx.reply(
            ephemeralErrorReply(
              commandName,
              errorEmbed(commandName).setDescription("Pick a number from 1 to 8 for Quadruple or Bust.")
            )
          );
        }
        const rolled = 1 + Math.floor(Math.random() * 8);
        win = rolled === chosen;
        multiplier = economyConfig.gambleQuadruplePayout;
        outcomeLine = `The rune lands on **${rolled}**${win ? `, exactly your ${chosen}!` : "."}`;
        break;
      }
      default: {
        win = Math.random() < 0.66;
        multiplier = economyConfig.gambleLowPayout;
        outcomeLine = win
          ? "Arona leans into the headpat. She seems pleased."
          : "Arona flinches away. No runes.";
        break;
      }
    }

    const result = await runesService.gamble(globalUser.id, amount, multiplier, win);
    if (!result) {
      const bal = await runesService.getBalance(globalUser.id);
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `You only have ${runes(bal.wallet)} in your wallet. Deposit some or earn more first.`
          )
        )
      );
    }

    const embed = baseEmbed(commandName)
      .setTitle("🎰 Gamble")
      .setDescription(
        win
          ? `You won **${result.payout.toLocaleString()} runes**!`
          : `You lost **${amount.toLocaleString()} runes**.`
      )
      .addFields(
        { name: "Result", value: outcomeLine, inline: true },
        { name: "Wallet", value: runes(result.wallet), inline: true }
      );
    return ctx.reply({ embeds: [embed] });
  }
}
