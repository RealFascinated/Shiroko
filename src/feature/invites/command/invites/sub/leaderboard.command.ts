import Command, { type ExecuteContext } from "../../../../../command/command";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { ordinal } from "../../../../../lib/format";
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
    const rows = await invitesService.leaderboard(guildId);
    if (rows.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("No invites tracked in this server yet.")
        )
      );
    }
    const members = await guild?.members.fetch();
    const lines = rows.slice(0, 10).map((row, index) => {
      const member = members?.get(row.inviterId);
      const name = member?.displayName ?? `<@${row.inviterId}>`;
      return `**${ordinal(index + 1)}.** ${name} — **${row.invites}** invite${row.invites === 1 ? "" : "s"}`;
    });
    const embed = baseEmbed(commandName)
      .setTitle(`📨 Invite Leaderboard — ${guild?.name}`)
      .setDescription(lines.join("\n"));
    if (guild) {
      const canTrack = await invitesService.canTrack(guild);
      if (!canTrack) {
        embed.setFooter({ text: "Missing Manage Guild permission — some joins may be untracked." });
      }
    }
    return ctx.reply({ embeds: [embed] });
  }
}
