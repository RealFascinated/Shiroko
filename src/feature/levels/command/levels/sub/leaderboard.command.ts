import Command, { type ExecuteContext } from "../../../../../command/command";
import LeaderboardManager from "../../../../../leaderboard";
import { LeaderboardId } from "../../../../../leaderboard/leaderboard";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { ordinal } from "../../../../../lib/format";
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
    const page = await LeaderboardManager.getLeaderboard(LeaderboardId.Level).getPage(guildId, 1);
    if (page.rows.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No tracked levels in this server yet.")
        )
      );
    }
    const lines = page.rows.map((row, index) => {
      return `**${ordinal(index + 1)}.** <@${row.id}>: **${levelForXp(row.value)}** (${row.value.toLocaleString("en-US")} XP)`;
    });
    const embed = baseEmbed(commandName)
      .setTitle("📊 Levelling Leaderboard")
      .setDescription(lines.join("\n"));
    return ctx.reply({ embeds: [embed] });
  }
}
