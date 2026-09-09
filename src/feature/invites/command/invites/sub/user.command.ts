import { and, count, eq } from "drizzle-orm";
import Command, { type ExecuteContext } from "../../../../../command/command";
import { userOption } from "../../../../../command/option";
import { db } from "../../../../../db";
import { inviteJoins } from "../../../../../db/schema";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../lib/embed";
import { invitesService } from "../../../invites.service";

/**
 * Show the total invites attributed to one user in the guild.
 */
export default class InvitesUserCommand extends Command {
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
