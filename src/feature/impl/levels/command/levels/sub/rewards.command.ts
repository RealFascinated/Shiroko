import Command, { type ExecuteContext } from "@/command/command";
import { levelsService } from "@/feature/impl/levels/levels.service";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";

export default class RewardsCommand extends Command {
  constructor() {
    super({ id: "rewards", displayName: "Show the server's level-up rewards" });
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const rewards = await levelsService.rewards(guild.id);
    if (rewards.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No level-up rewards configured yet.")
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
