import Command, { type ExecuteContext } from "../../../../../command/command";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { levelsService } from "../../../levels.service";

/**
 * Show every level-up reward the server has configured, one line per
 * milestone level, ordered by level.
 */
export default class RewardsCommand extends Command {
  constructor() {
    super("rewards", "Show the server's level-up rewards");
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const rewards = await levelsService.rewards(guild.id);
    if (rewards.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            "No level-up rewards configured yet. Use `/level-config add-role` to set one."
          )
        )
      );
    }
    const lines = rewards.map(
      reward => `Level **${reward.level}**: ${reward.roleId ? `<@&${reward.roleId}>` : "*(no role)*"}`
    );
    const embed = baseEmbed(commandName)
      .setTitle(`🏅 Level Rewards: ${guild.name}`)
      .setDescription(lines.join("\n"));
    return ctx.reply({ embeds: [embed] });
  }
}
