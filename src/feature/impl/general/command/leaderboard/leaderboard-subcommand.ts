import Command, { type ExecuteContext } from "@/command/command";
import type Leaderboard from "@/leaderboard/leaderboard";
import { type LeaderboardPosition, type LeaderboardRow } from "@/leaderboard/leaderboard";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { ordinal } from "@/lib/format";
import { attachPager, type Page } from "@/lib/pagination";
import type { Guild } from "discord.js";

/**
 * A leaderboard subcommand: shows the given board from page 1, closes it
 * with the caller's own position, and attaches the button pager
 * (`attachPager`) when the board spans more than one page. Subclasses
 * supply the board, the embed title, the empty-state message, and the
 * score format; fetching, empty state, rendering, and paging are shared.
 */
export default abstract class LeaderboardSubCommand extends Command {
  public abstract get board(): Leaderboard<LeaderboardRow>;
  public abstract get title(): string;
  public abstract get emptyMessage(): string;

  /**
   * Format one row's score, without its position or mention. The base
   * composes it into both the page rows and the caller's position line,
   * so the two always agree on units.
   */
  protected abstract renderValue(row: LeaderboardRow): string;

  /**
   * Optional embed footer for this board (e.g. a tracking caveat).
   * `null` means no footer.
   */
  protected async footerText(guild: Guild): Promise<string | null> {
    return null;
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
    const board = this.board;
    const [firstPage, standing] = await Promise.all([
      board.getPage(guildId, 1),
      board.getPosition(guildId, ctx.user.id),
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
      const footer = await this.footerText(guild);
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
    const response = await ctx.reply(await render(firstPage));
    await attachPager(response, {
      namespace: this.id,
      userId: ctx.user.id,
      page: firstPage,
      fetchPage: page => board.getPage(guildId, page),
      render,
    });
  }
}
