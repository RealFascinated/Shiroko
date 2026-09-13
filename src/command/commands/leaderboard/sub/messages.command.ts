import Command, { type ExecuteContext } from "../../../../command/command";
import LeaderboardManager from "../../../../leaderboard";
import { LeaderboardId } from "../../../../leaderboard/leaderboard";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../lib/embed";
import { ordinal, pluralise } from "../../../../lib/format";

/**
 * Show the server's total message-count leaderboard, most messages first.
 */
export default class MessagesLeaderboardCommand extends Command {
  constructor() {
    super("messages", "Show the server's total message-count leaderboard");
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const guildId = guild.id;
    const page = await LeaderboardManager.getLeaderboard(LeaderboardId.Messages).getPage(guildId, 1);
    if (page.rows.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No messages tracked in this server yet.")
        )
      );
    }
    const lines = page.rows.map((row, index) => {
      return `**${ordinal(index + 1)}.** <@${row.id}>: **${row.value.toLocaleString("en-US")}** ${pluralise(row.value, "message")}`;
    });
    const embed = baseEmbed(commandName).setTitle("💬 Messages Leaderboard").setDescription(lines.join("\n"));
    return ctx.reply({ embeds: [embed] });
  }
}
