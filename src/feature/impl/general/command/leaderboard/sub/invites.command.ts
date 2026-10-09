import { invitesService } from "@/feature/impl/invites/invites.service";
import LeaderboardManager from "@/leaderboard/index";
import type Leaderboard from "@/leaderboard/leaderboard";
import { LeaderboardId, type LeaderboardRow } from "@/leaderboard/leaderboard";
import { pluralise } from "@/lib/format";
import type { Guild } from "discord.js";
import LeaderboardSubCommand from "../leaderboard-subcommand";

export default class InvitesLeaderboardCommand extends LeaderboardSubCommand {
  constructor() {
    super({ id: "invites", displayName: "Show the server's invite leaderboard" });
  }

  public override get board(): Leaderboard<LeaderboardRow> {
    return LeaderboardManager.getLeaderboard(LeaderboardId.Invites);
  }

  public override get title(): string {
    return "📨 Invite Leaderboard";
  }

  public override get emptyMessage(): string {
    return "No invites tracked in this server yet.";
  }

  protected override renderValue(row: LeaderboardRow): string {
    return `**${row.value}** ${pluralise(row.value, "invite")}`;
  }

  protected override async footerText(guild: Guild): Promise<string | null> {
    if (!(await invitesService.canTrack(guild))) {
      return "Missing Manage Guild permission; some joins may be untracked.";
    }
    return null;
  }
}
