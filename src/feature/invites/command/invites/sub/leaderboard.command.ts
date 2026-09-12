import Command, { type ExecuteContext } from "../../../../../command/command";
import LeaderboardManager from "../../../../../leaderboard";
import { LeaderboardId } from "../../../../../leaderboard/leaderboard";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { ordinal, pluralise } from "../../../../../lib/format";
import { invitesService } from "../../../invites.service";

/**
 * Show the server's invite leaderboard, most invites first.
 */
export default class InvitesLeaderboardCommand extends Command {
  constructor() {
    super("leaderboard", "Show the server's invite leaderboard");
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    const guildId = guild?.id ?? ctx.guildId;
    if (!guildId) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Invites are only available in servers.")
        )
      );
    }
    const page = await LeaderboardManager.getLeaderboard(LeaderboardId.Invites).getPage(guildId, 1);
    if (page.rows.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No invites tracked in this server yet.")
        )
      );
    }
    const lines = page.rows.map((row, index) => {
      return `**${ordinal(index + 1)}.** <@${row.id}>: **${row.value}** ${pluralise(row.value, "invite")}`;
    });
    const embed = baseEmbed(commandName).setTitle("📨 Invite Leaderboard").setDescription(lines.join("\n"));
    if (guild) {
      const canTrack = await invitesService.canTrack(guild);
      if (!canTrack) {
        embed.setFooter({ text: "Missing Manage Guild permission; some joins may be untracked." });
      }
    }
    return ctx.reply({ embeds: [embed] });
  }
}
