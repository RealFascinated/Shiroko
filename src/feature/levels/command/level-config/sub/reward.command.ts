import Command, { type ExecuteContext } from "../../../../../command/command";
import {
  booleanOption,
  integerOption,
  roleOption,
  type CommandOptionBuilder,
} from "../../../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { PermissionFlags } from "../../../../../permission/permissions";
import { levelsService } from "../../../levels.service";
import { configSummaryLines } from "./view.command";

/**
 * Set or clear the role granted at a milestone level. Requires both a
 * level and a role; the `clear` flag removes the reward instead.
 */
export default class RewardCommand extends Command {
  constructor() {
    super("reward", "Set or clear a level-up reward role");
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_CONFIG_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      integerOption(true, "level", "Level the reward unlocks at"),
      roleOption(false, "role", "Role granted at that level"),
      booleanOption(false, "clear", "Remove the reward at that level instead"),
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
    const role = ctx.options.getRole("role");
    const clear = ctx.options.getBoolean("clear") ?? false;

    if (clear) {
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
    if (!role) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Provide a role to set as the reward.")
        )
      );
    }
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
