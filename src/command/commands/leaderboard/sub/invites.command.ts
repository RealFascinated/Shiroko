import { invitesService } from "@/feature/impl/invites/invites.service";
import LeaderboardManager from "@/leaderboard/index";
import type Leaderboard from "@/leaderboard/leaderboard";
import { LeaderboardId, type LeaderboardRow } from "@/leaderboard/leaderboard";
import { ordinal, pluralise } from "@/lib/format";
import type { Guild } from "discord.js";
import LeaderboardSubCommand from "../leaderboard-subcommand";

/**
 * Show the server's invite leaderboard, most invites first.
 */
export default class InvitesLeaderboardCommand extends LeaderboardSubCommand {
  constructor() {
    super("invites", "Show the server's invite leaderboard");
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

  protected override renderRow(row: LeaderboardRow, position: number, name: string): string {
    return `**${ordinal(position)}.** ${name}: **${row.value}** ${pluralise(row.value, "invite")}`;
  }

  protected override async footerText(guild: Guild): Promise<string | null> {
    if (!(await invitesService.canTrack(guild))) {
      return "Missing Manage Guild permission; some joins may be untracked.";
    }
    return null;
  }
}
