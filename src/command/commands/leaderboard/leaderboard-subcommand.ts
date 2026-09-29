import Command, { type ExecuteContext } from "@/command/command";
import type Leaderboard from "@/leaderboard/leaderboard";
import { type LeaderboardRow } from "@/leaderboard/leaderboard";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { attachPager, type Page } from "@/lib/pagination";
import type { Guild } from "discord.js";

/**
 * A leaderboard subcommand: shows the given board from page 1 and attaches
 * the button pager (`attachPager`) when the board spans more than one page.
 * Subclasses supply the board, the embed title, the empty-state message,
 * and the row format; fetching, empty state, rendering, and paging are
 * shared.
 */
export default abstract class LeaderboardSubCommand extends Command {
  public abstract get board(): Leaderboard<LeaderboardRow>;
  public abstract get title(): string;
  public abstract get emptyMessage(): string;

  /**
   * Format one row of the page. `position` is the 1-based position in the
   * full ranking, so a 20-per-page board's second page starts at 21.
   */
  protected abstract renderRow(row: LeaderboardRow, position: number): string;

  /**
   * Optional embed footer for this board (e.g. a tracking caveat).
   * `null` means no footer.
   */
  protected async footerText(guild: Guild): Promise<string | null> {
    return null;
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const guildId = guild.id;
    const board = this.board;
    const render = async (page: Page<LeaderboardRow>) => {
      const lines = page.rows.map((row, index) => {
        const position = (page.page - 1) * page.pageSize + index + 1;
        return this.renderRow(row, position);
      });
      const embed = baseEmbed(commandName).setTitle(this.title).setDescription(lines.join("\n"));
      const footer = await this.footerText(guild);
      if (footer) {
        embed.setFooter({ text: footer });
      }
      return {
        embeds: [embed],
      };
    };
    const firstPage = await board.getPage(guildId, 1);
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
