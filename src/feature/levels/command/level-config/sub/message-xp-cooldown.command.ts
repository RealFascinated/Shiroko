import Command, { type ExecuteContext } from "../../../../../command/command";
import { integerOption, type CommandOptionBuilder } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./config-helpers";

/**
 * Set the minimum time between XP-granting messages. The floor of 10s
 * prevents a cooldown of 0; with no cooldown, every message grants XP
 * and the system is trivially farmable.
 */
export default class MessageXpCooldownCommand extends Command {
  constructor() {
    super("message-xp-cooldown", "Set the message XP cooldown");
  }

  public override get options(): CommandOptionBuilder[] {
    return [integerOption(true, "seconds", "Seconds between XP-granting messages (10+)", 10)];
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const cooldown = ctx.options.getInteger("seconds", true)!;
    if (cooldown < 10) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Cooldown must be at least 10 seconds.")
        )
      );
    }
    const config = await levelsService.setConfig(guild.id, { messageCooldownSeconds: cooldown });
    const embed = baseEmbed(commandName)
      .setTitle("⏱️ Cooldown Updated")
      .setDescription(
        `Messages now grant XP at most every **${config.messageCooldownSeconds}s**.\n${configSummaryLines(config).join("\n")}`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
