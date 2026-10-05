import Command, { type ExecuteContext } from "@/command/command";
import { integerOption, type CommandOptionBuilder } from "@/command/option";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { PermissionFlags } from "@/permission/permissions";

/**
 * Remove the level-up reward configured at a level. Gated by
 * `LEVELS_COMMAND`; the rest of `/levels` stays open.
 */
export default class RewardRemoveCommand extends Command {
  constructor() {
    super({ id: "reward-remove", displayName: "Remove the reward configured at a level" });
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.LEVELS_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [integerOption(true, "level", "Level whose reward to remove", 1)];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const level = ctx.options.getInteger("level", true);
    const rewards = await levelsService.rewards(guild.id);
    const reward = rewards.find(candidate => candidate.level === level);
    if (!reward) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(`No reward is configured at level ${level}.`)
        )
      );
    }

    await levelsService.removeReward(guild.id, level);
    const role = reward.roleId ? `<@&${reward.roleId}>` : "*(no role)*";
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("🏅 Level Reward Removed")
          .setDescription(`Removed ${role} from **level ${level}**.`),
      ],
    });
  }
}
