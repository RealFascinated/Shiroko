import Command, { type ExecuteContext } from "@/command/command";
import {
  birthdayService,
  UPCOMING_PAGE_SIZE,
  type UpcomingBirthday,
} from "@/feature/impl/birthday/birthday.service";
import { monthName } from "@/lib/date";
import { baseEmbed } from "@/lib/embed";
import { ordinal } from "@/lib/format";
import { attachPager, type Page } from "@/lib/pagination";

/**
 * List the server's saved birthdays, soonest first, with today's
 * celebrations called out and the button pager when they span more than
 * one page. Each page is fetched from the database by the service.
 */
export default class UpcomingCommand extends Command {
  constructor() {
    super({ id: "upcoming", displayName: "Show upcoming birthdays in this server" });
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const memberIds = new Set(guild.members.cache.keys());
    const title = `🎂 Upcoming Birthdays: ${guild.name}`;
    const fetchPage = (page: number): Promise<Page<UpcomingBirthday>> =>
      birthdayService.upcoming(guild.id, memberIds, page, UPCOMING_PAGE_SIZE);
    const firstPage = await fetchPage(1);

    if (firstPage.rows.length === 0) {
      return ctx.reply({
        embeds: [
          baseEmbed(commandName)
            .setTitle(title)
            .setDescription("No birthdays saved yet. Use `/birthday set` to add yours."),
        ],
      });
    }

    const render = (page: Page<UpcomingBirthday>) => {
      const lines = page.rows.map(entry => {
        const when =
          entry.inDays === 0 ? "**Today!**" : `in ${entry.inDays} day${entry.inDays === 1 ? "" : "s"}`;
        return `<@${entry.userId}> - ${monthName(entry.month)} ${ordinal(entry.day)} (${when}), turning **${entry.age}**`;
      });
      return { embeds: [baseEmbed(commandName).setTitle(title).setDescription(lines.join("\n"))] };
    };
    const response = await ctx.reply(render(firstPage));
    await attachPager(response, {
      namespace: "birthday-upcoming",
      userId: ctx.user.id,
      page: firstPage,
      fetchPage,
      render,
    });
  }
}
