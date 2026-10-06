import Command, { type ExecuteContext } from "@/command/command";
import type { CommandOptionBuilder } from "@/command/option";
import { stringOption } from "@/command/option";
import { baseEmbed } from "@/lib/embed";
import { pick } from "@/lib/utils";

const SIDES = ["Heads", "Tails"] as const;

export default class CoinflipCommand extends Command {
  constructor() {
    super({ id: "coinflip", displayName: "Flip a coin" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      stringOption(false, "side", "Call the flip before it lands", {
        choices: { heads: "Heads", tails: "Tails" },
      }),
    ];
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const called = args.string("side");
    const result = pick(SIDES);
    const flavor =
      called === null
        ? ""
        : ` ${called === result.toLowerCase() ? "You called it." : "Better luck next flip."}`;
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🪙 Coin Flip")
          .setDescription(`The coin lands on **${result}**.${flavor}`),
      ],
    });
  }
}
