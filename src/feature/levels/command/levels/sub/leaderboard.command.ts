import Command, { type ExecuteContext } from "../../../../../command/command";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { ordinal } from "../../../../../lib/format";
import { levelsService } from "../../../levels.service";
import { levelForXp } from "../../../xp";

/**
 * Show the server's levelling leaderboard, most XP first.
 */
export default class LeaderboardCommand extends Command {
  constructor() {
    super("leaderboard", "Show the server's levelling leaderboard");
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const guildId = guild.id;
    const rows = await levelsService.leaderboard(guildId, 10);
    if (rows.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No tracked levels in this server yet.")
        )
      );
    }
    const members = await guild.members.fetch();
    const lines = rows.map((row, index) => {
      const member = members.get(row.userId);
      const name = member?.displayName ?? `<@${row.userId}>`;
      return `**${ordinal(index + 1)}.** ${name}: **level ${levelForXp(row.xp)}** (${row.xp} XP)`;
    });
    const embed = baseEmbed(commandName)
      .setTitle(`📊 Levelling Leaderboard: ${guild.name}`)
      .setDescription(lines.join("\n"));
    return ctx.reply({ embeds: [embed] });
  }
}
