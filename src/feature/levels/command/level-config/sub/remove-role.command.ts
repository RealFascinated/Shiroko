import Command, { type ExecuteContext } from "../../../../../command/command";
import { integerOption, type CommandOptionBuilder } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./view.command";

/**
 * Remove the reward role granted at a milestone level.
 */
export default class RemoveRoleCommand extends Command {
  constructor() {
    super("remove-role", "Remove the role reward at a level");
  }

  public override get options(): CommandOptionBuilder[] {
    return [integerOption(true, "level", "Level to remove the reward from")];
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const level = ctx.options.getInteger("level", true)!;
    if (level < 1) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("Reward levels start at 1."))
      );
    }
    await levelsService.removeReward(guild.id, level);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🏅 Reward Removed")
          .setDescription(
            `Removed the level **${level}** reward.\n${configSummaryLines(await levelsService.getConfig(guild.id)).join("\n")}`
          ),
      ],
    });
  }
}
