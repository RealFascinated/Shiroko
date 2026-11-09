import { invitesService } from "@/feature/impl/invites/invites.service";
import { levelForXp } from "@/feature/impl/levels/xp";
import type { InviteLeaderboardRow } from "@/leaderboard/impl/invite-leaderboard";
import { LeaderboardId } from "@/leaderboard/leaderboard";
import { formatCount, pluralise } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import type { LeaderboardDefinition } from "./leaderboard-subcommand";

/** Every `/leaderboard` subcommand, in the order Discord lists them. */
export const LEADERBOARDS: readonly LeaderboardDefinition[] = [
  {
    id: "level",
    displayName: "Show the server's levelling leaderboard",
    board: LeaderboardId.Level,
    title: "📊 Levelling Leaderboard",
    emptyMessage: "No tracked levels in this server yet.",
    renderValue: row => `Level **${levelForXp(row.value)}** · ${formatCount(row.value)} XP`,
  },
  {
    id: "messages",
    displayName: "Show the server's total message-count leaderboard",
    board: LeaderboardId.Messages,
    title: "💬 Messages Leaderboard",
    emptyMessage: "No messages tracked in this server yet.",
    renderValue: row => `**${formatCount(row.value)}** ${pluralise(row.value, "message")}`,
  },
  {
    id: "invites",
    displayName: "Show the server's invite leaderboard",
    board: LeaderboardId.Invites,
    title: "📨 Invite Leaderboard",
    emptyMessage: "No invites tracked in this server yet.",
    renderValue: row => {
      const invites = row as InviteLeaderboardRow;
      return `**${formatCount(invites.value)}** ${pluralise(invites.value, "invite")} · ${formatCount(invites.leaves)} left`;
    },
    note: async guild =>
      (await invitesService.canTrack(guild))
        ? null
        : "Missing Manage Guild permission; some joins may be untracked.",
  },
  {
    id: "voice",
    displayName: "Show the server's voice-time leaderboard",
    board: LeaderboardId.Voice,
    title: "🎧 Voice Time Leaderboard",
    emptyMessage: "No voice time tracked in this server yet.",
    renderValue: row => `**${formatDuration(row.value * 1000)}**`,
  },
];
