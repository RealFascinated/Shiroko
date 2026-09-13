import type { Guild } from "discord.js";
import Command, { type ExecuteContext } from "../../../../command/command";
import type Leaderboard from "../../../../leaderboard/leaderboard";
import { type LeaderboardRow } from "../../../../leaderboard/leaderboard";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../lib/embed";
import { attachPager } from "../../../../lib/pagination";

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
   * full ranking, so a 10-per-page board's second page starts at 11.
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
    const page = await this.board.getPage(guildId, 1);
    if (page.rows.length === 0) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription(this.emptyMessage))
      );
    }
    const renderPage = async (pageNo: number) => {
      const data = await this.board.getPage(guildId, pageNo);
      const lines = data.rows.map((row, index) => {
        const position = (pageNo - 1) * data.pageSize + index + 1;
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
    const response = await ctx.reply(await renderPage(1));
    await attachPager(response, {
      namespace: this.id,
      userId: ctx.user.id,
      pageCount: page.pageCount,
      render: renderPage,
    });
  }
}
