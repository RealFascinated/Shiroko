import Command, { type ExecuteContext } from "@/command/command";
import LeaderboardManager from "@/leaderboard/index";
import type Leaderboard from "@/leaderboard/leaderboard";
import type { LeaderboardId, LeaderboardPosition, LeaderboardRow } from "@/leaderboard/leaderboard";
import { baseEmbed } from "@/lib/embed";
import { formatCount, ordinal } from "@/lib/format";
import { replyPaged, type Page } from "@/lib/pagination";
import type { Guild } from "discord.js";

const MEDALS = ["🥇", "🥈", "🥉"];

/** What one leaderboard subcommand adds to the shared page-and-position flow. */
export interface LeaderboardDefinition {
  /** The subcommand id, also its pager namespace. */
  readonly id: string;
  readonly displayName: string;
  readonly board: LeaderboardId;
  readonly title: string;
  readonly emptyMessage: string;
  /** Format one row's score, without its position or mention. */
  readonly renderValue: (row: LeaderboardRow) => string;
  /** Optional caveat shown as subtext under the board, e.g. a tracking warning. */
  readonly note?: (guild: Guild) => Promise<string | null>;
}

/**
 * A leaderboard subcommand: shows the given board from page 1 and closes it
 * with the caller's own rank, paged through `replyPaged`. Fetching, empty
 * state, rendering, and paging are shared; the definition supplies the board,
 * its title, the empty-state message, and the score format.
 */
export default class LeaderboardSubCommand extends Command {
  private readonly board: Leaderboard<LeaderboardRow>;
  private readonly title: string;
  private readonly emptyMessage: string;
  private readonly renderValue: (row: LeaderboardRow) => string;
  private readonly note: ((guild: Guild) => Promise<string | null>) | undefined;

  constructor(definition: LeaderboardDefinition) {
    super({ id: definition.id, displayName: definition.displayName });
    this.board = LeaderboardManager.getLeaderboard(definition.board);
    this.title = definition.title;
    this.emptyMessage = definition.emptyMessage;
    this.renderValue = definition.renderValue;
    this.note = definition.note;
  }

  /**
   * Format one row of the page. `position` is the 1-based position in the
   * full ranking, so a 15-per-page board's second page starts at 16. The top
   * three wear medals, and the caller's own row is marked.
   */
  protected renderRow(row: LeaderboardRow, position: number, callerId: string): string {
    const badge = MEDALS[position - 1] ?? `\`#${position}\``;
    const you = row.id === callerId ? " ← **you**" : "";
    return `${badge} <@${row.id}> · ${this.renderValue(row)}${you}`;
  }

  private renderPosition(standing: LeaderboardPosition<LeaderboardRow>): string {
    if (standing.position === null || standing.row === null) {
      return "**Your rank:** not ranked yet";
    }
    return `**Your rank:** ${ordinal(standing.position)} of ${formatCount(standing.total)} · ${this.renderValue(standing.row)}`;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const callerId = ctx.user.id;
    // Started alongside page 1 rather than awaited first, so both queries run at once.
    const extras = Promise.all([this.board.getPosition(guild.id, callerId), this.note?.(guild) ?? null]);
    return replyPaged(ctx, {
      namespace: this.id,
      fetchPage: page => this.board.getPage(guild.id, page),
      render: async (page: Page<LeaderboardRow>) => {
        const [standing, note] = await extras;
        const rows = page.rows.map((row, index) =>
          this.renderRow(row, (page.page - 1) * page.pageSize + index + 1, callerId)
        );
        const lines = [...rows, "", this.renderPosition(standing), ...(note ? [`-# ⚠️ ${note}`] : [])];
        return { embeds: [baseEmbed(commandName).setTitle(this.title).setDescription(lines.join("\n"))] };
      },
      empty: { embeds: [baseEmbed(commandName).setTitle(this.title).setDescription(this.emptyMessage)] },
    });
  }
}
