import Command, { type ExecuteContext } from "@/command/command";
import { userOption } from "@/command/option";
import { db } from "@/db/index";
import { inviteJoinsSchema } from "@/db/schemas/invite-joins";
import { invitesService } from "@/feature/impl/invites/invites.service";
import { baseEmbed } from "@/lib/embed";
import { pluralise } from "@/lib/format";
import { and, count, eq } from "drizzle-orm";

export default class InvitesUserCommand extends Command {
  constructor() {
    super({ id: "user", displayName: "Show the invites attributed to a user" });
  }

  public override get options() {
    return [userOption(false, "user", "Whose invites to show (defaults to you)")];
  }

  protected override async onExecuteSlash({ user, ctx, args, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const target = args.user("user") ?? user.discordUser;
    const canTrack = await invitesService.canTrack(guild);
    const [row] = await db
      .select({ invites: count(inviteJoinsSchema.inviterId) })
      .from(inviteJoinsSchema)
      .where(and(eq(inviteJoinsSchema.guildId, guild.id), eq(inviteJoinsSchema.inviterId, target.id)));
    const total = row?.invites ?? 0;
    const embed = baseEmbed(commandName)
      .setTitle("📨 Invites")
      .setDescription(
        `${target} has invited **${total}** ${pluralise(total, "member")} to **${guild.name}**.`
      );
    if (!canTrack) {
      embed.setFooter({ text: "Missing Manage Guild permission; some joins may be untracked." });
    }
    return ctx.reply({ embeds: [embed] });
  }
}
