import Command, { type ExecuteContext } from "@/command/command";
import { integerOption, type CommandOptionBuilder } from "@/command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { randInt } from "@/lib/math";

export default class RollCommand extends Command {
  constructor() {
    super({ id: "roll", displayName: "Roll a random number between a minimum and a maximum" });
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      integerOption(false, "min", "Lowest number (default 1)"),
      integerOption(false, "max", "Highest number (default 100)"),
    ];
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, args, commandName }: ExecuteContext) {
    const min = args.integer("min") ?? 1;
    const max = args.integer("max") ?? 100;
    if (min > max) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("The minimum cannot be greater than the maximum.")
        )
      );
    }
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🎲 Roll")
          .setDescription(`You rolled **${randInt(min, max)}** (${min}-${max}).`),
      ],
    });
  }
}
