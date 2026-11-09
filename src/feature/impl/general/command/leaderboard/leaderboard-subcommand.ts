import Command, { type ExecuteContext } from "@/command/command";
import LeaderboardManager from "@/leaderboard/index";
import type Leaderboard from "@/leaderboard/leaderboard";
import type { LeaderboardId, LeaderboardPosition, LeaderboardRow } from "@/leaderboard/leaderboard";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { ordinal } from "@/lib/format";
import { createPager, type Page } from "@/lib/pagination";
import type { Guild } from "discord.js";

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
  /** Optional embed footer, e.g. a tracking caveat. */
  readonly footer?: (guild: Guild) => Promise<string | null>;
}

/**
 * A leaderboard subcommand: shows the given board from page 1 and closes it
 * with the caller's own position, with the button pager (`createPager`) in
 * the reply when the board spans more than one page. Fetching, empty state,
 * rendering, and paging are shared; the definition supplies the board, its
 * title, the empty-state message, and the score format.
 */
export default class LeaderboardSubCommand extends Command {
  private readonly board: Leaderboard<LeaderboardRow>;
  private readonly title: string;
  private readonly emptyMessage: string;
  private readonly renderValue: (row: LeaderboardRow) => string;
  private readonly footer: ((guild: Guild) => Promise<string | null>) | undefined;

  constructor(definition: LeaderboardDefinition) {
    super({ id: definition.id, displayName: definition.displayName });
    this.board = LeaderboardManager.getLeaderboard(definition.board);
    this.title = definition.title;
    this.emptyMessage = definition.emptyMessage;
    this.renderValue = definition.renderValue;
    this.footer = definition.footer;
  }

  /**
   * Format one row of the page. `position` is the 1-based position in the
   * full ranking, so a 20-per-page board's second page starts at 21. The
   * row is mentioned via `<@id>`.
   */
  protected renderRow(row: LeaderboardRow, position: number): string {
    return `**${ordinal(position)}.** <@${row.id}>: ${this.renderValue(row)}`;
  }

  /**
   * The caller's own position, closing the embed under the ranked rows.
   * Unranked callers get a plain "not ranked yet" instead of a score.
   */
  private renderPosition(standing: LeaderboardPosition<LeaderboardRow>): string {
    if (standing.position === null || standing.row === null) {
      return "**Your position:** not ranked yet";
    }
    return `**Your position:** **${standing.position}**/**${standing.total}** · ${this.renderValue(standing.row)}`;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const guildId = guild.id;
    const [firstPage, standing] = await Promise.all([
      this.board.getPage(guildId, 1),
      this.board.getPosition(guildId, ctx.user.id),
    ]);
    const render = async (page: Page<LeaderboardRow>) => {
      const lines = [
        ...page.rows.map((row, index) => {
          const rank = (page.page - 1) * page.pageSize + index + 1;
          return this.renderRow(row, rank);
        }),
        "",
        this.renderPosition(standing),
      ];
      const embed = baseEmbed(commandName).setTitle(this.title).setDescription(lines.join("\n"));
      const footer = (await this.footer?.(guild)) ?? null;
      if (footer) {
        embed.setFooter({ text: footer });
      }
      return {
        embeds: [embed],
      };
    };
    if (firstPage.rows.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription(this.emptyMessage))
      );
    }
    const pager = createPager({
      namespace: this.id,
      userId: ctx.user.id,
      page: firstPage,
      fetchPage: page => this.board.getPage(guildId, page),
      render,
    });
    const response = await ctx.reply(await pager.payload(firstPage));
    pager.attach(response);
  }
}
