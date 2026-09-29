import Command, { type ExecuteContext } from "@/command/command";
import type Leaderboard from "@/leaderboard/leaderboard";
import { type LeaderboardRow } from "@/leaderboard/leaderboard";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { fetchGuildMember } from "@/lib/guild";
import { attachPager, type Page } from "@/lib/pagination";
import type { ChatInputCommandInteraction, Guild } from "discord.js";

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
   * `name` is the resolved display name.
   */
  protected abstract renderRow(row: LeaderboardRow, position: number, name: string): string;

  /**
   * Optional embed footer for this board (e.g. a tracking caveat).
   * `null` means no footer.
   */
  protected async footerText(guild: Guild): Promise<string | null> {
    return null;
  }

  /**
   * Resolve a user id to a display name: the member's display name if they
   * are still in the guild, their Discord username if not, or the raw id.
   */
  private async resolveName(guild: Guild, ctx: ChatInputCommandInteraction, userId: string): Promise<string> {
    const member = await fetchGuildMember(guild, userId);
    if (member) {
      return member.displayName;
    }
    try {
      return (await ctx.client.users.fetch(userId)).username;
    } catch {
      return userId;
    }
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const guildId = guild.id;
    const board = this.board;
    const render = async (page: Page<LeaderboardRow>) => {
      const rows = await Promise.all(
        page.rows.map(async row => [row, await this.resolveName(guild, ctx, row.id)] as const)
      );
      const lines = rows.map(([row, name], index) => {
        const position = (page.page - 1) * page.pageSize + index + 1;
        return this.renderRow(row, position, name);
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
