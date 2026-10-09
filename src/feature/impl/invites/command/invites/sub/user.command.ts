import Command, { type ExecuteContext } from "@/command/command";
import { userOption } from "@/command/option";
import { invitesService } from "@/feature/impl/invites/invites.service";
import type { InviteLeaderboardRow } from "@/leaderboard/impl/invite-leaderboard";
import LeaderboardManager from "@/leaderboard/index";
import { LeaderboardId } from "@/leaderboard/leaderboard";
import { baseEmbed } from "@/lib/embed";
import { pluralise } from "@/lib/format";

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
    const [canTrack, standing] = await Promise.all([
      invitesService.canTrack(guild),
      LeaderboardManager.getLeaderboard<InviteLeaderboardRow>(LeaderboardId.Invites).getPosition(
        guild.id,
        target.id
      ),
    ]);
    const total = standing.row?.value ?? 0;
    const leaves = standing.row?.leaves ?? 0;
    const joins = total - leaves;
    const embed = baseEmbed(commandName)
      .setTitle("📨 Invites")
      .setDescription(
        `${target}: **${joins}** ${pluralise(joins, "join")} · **${total}** total · **${leaves}** fake.`
      );
    if (!canTrack) {
      embed.setFooter({ text: "Missing Manage Guild permission; some joins may be untracked." });
    }
    return ctx.reply({ embeds: [embed] });
  }
}
