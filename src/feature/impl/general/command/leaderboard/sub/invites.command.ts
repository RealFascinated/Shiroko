import { invitesService } from "@/feature/impl/invites/invites.service";
import type { InviteLeaderboardRow } from "@/leaderboard/impl/invite-leaderboard";
import LeaderboardManager from "@/leaderboard/index";
import type Leaderboard from "@/leaderboard/leaderboard";
import { LeaderboardId } from "@/leaderboard/leaderboard";
import { pluralise } from "@/lib/format";
import type { Guild } from "discord.js";
import LeaderboardSubCommand from "../leaderboard-subcommand";

export default class InvitesLeaderboardCommand extends LeaderboardSubCommand<InviteLeaderboardRow> {
  constructor() {
    super({ id: "invites", displayName: "Show the server's invite leaderboard" });
  }

  public override get board(): Leaderboard<InviteLeaderboardRow> {
    return LeaderboardManager.getLeaderboard<InviteLeaderboardRow>(LeaderboardId.Invites);
  }

  public override get title(): string {
    return "📨 Invite Leaderboard";
  }

  public override get emptyMessage(): string {
    return "No invites tracked in this server yet.";
  }

  protected override renderValue(row: InviteLeaderboardRow): string {
    return `**${row.value}** ${pluralise(row.value, "invite")} · **${row.leaves}** ${pluralise(row.leaves, "leave")}`;
  }

  protected override async footerText(guild: Guild): Promise<string | null> {
    if (!(await invitesService.canTrack(guild))) {
      return "Missing Manage Guild permission; some joins may be untracked.";
    }
    return null;
  }
}
