import { and, count, eq } from "drizzle-orm";
import Command, { type ExecuteContext } from "../../../command/command";
import { userOption } from "../../../command/option";
import { db } from "../../../db";
import { inviteJoins } from "../../../db/schema";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../lib/embed";
import { ordinal } from "../../../lib/format";
import { invitesService } from "../invites.service";

/**
 * Show invite stats: who you (or another user) invited, or the server's
 * invite leaderboard. Guild-only — invite tracking is per-guild.
 */
export default class InvitesCommand extends Command {
  constructor() {
    super("invites", "Show invite stats");
    this.registerSubCommand(new InvitesUserCommand());
    this.registerSubCommand(new InvitesLeaderboardCommand());
  }

  protected override async onExecuteSlash({ ctx }: ExecuteContext) {
    return ctx.reply({
      content: "Choose a subcommand: /invites user or /invites leaderboard",
    });
  }
}

/**
 * Show the total invites attributed to one user in the guild.
 */
class InvitesUserCommand extends Command {
  constructor() {
    super("user", "Show the invites attributed to a user");
  }

  public override get options() {
    return [userOption(false, "user", "Whose invites to show (defaults to you)")];
  }

  protected override async onExecuteSlash({ globalUser, guild, ctx, args, commandName }: ExecuteContext) {
    if (!guild) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Invites are only available in servers.")
        )
      );
    }
    const target = args.user("user") ?? globalUser.discordUser;
    const canTrack = await invitesService.canTrack(guild);
    const [row] = await db
      .select({ invites: count(inviteJoins.inviterId) })
      .from(inviteJoins)
      .where(and(eq(inviteJoins.guildId, guild.id), eq(inviteJoins.inviterId, target.id)));
    const total = row?.invites ?? 0;
    const embed = baseEmbed(commandName)
      .setTitle("📨 Invites")
      .setDescription(
        `${target} has invited **${total}** member${total === 1 ? "" : "s"} to **${guild.name}**.`
      );
    if (!canTrack) {
      embed.setFooter({ text: "Missing Manage Guild permission — some joins may be untracked." });
    }
    return ctx.reply({ embeds: [embed] });
  }
}

/**
 * Show the server's invite leaderboard, most invites first.
 */
class InvitesLeaderboardCommand extends Command {
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
