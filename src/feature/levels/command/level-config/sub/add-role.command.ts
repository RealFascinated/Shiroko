import Command, { type ExecuteContext } from "../../../../../command/command";
import { integerOption, roleOption, type CommandOptionBuilder } from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./view.command";

/**
 * Grant a role when a member reaches a milestone level. Already-set
 * rewards for the level are replaced.
 */
export default class AddRoleCommand extends Command {
  constructor() {
    super("add-role", "Set the role granted at a level");
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      integerOption(true, "level", "Level the reward unlocks at"),
      roleOption(true, "role", "Role granted at that level"),
    ];
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
    const role = ctx.options.getRole("role", true)!;
    await levelsService.setRewardRole(guild, level, role.id);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🏅 Reward Set")
          .setDescription(
            `Level **${level}** now grants **@${role.name}**.\n${configSummaryLines(await levelsService.getConfig(guild.id)).join("\n")}`
          ),
      ],
    });
  }
}
