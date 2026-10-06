import Command, { type ExecuteContext } from "@/command/command";
import {
  reminderService,
  REMINDER_RELATIVE_WINDOW_MS,
  type Reminder,
} from "@/feature/impl/reminders/reminder.service";
import { baseEmbed } from "@/lib/embed";
import { attachPager, type Page } from "@/lib/pagination";
import { timestampLabel } from "@/lib/time";

/**
 * List your pending reminders, soonest first, with the button pager when
 * they span more than one page.
 */
export default class ListCommand extends Command {
  constructor() {
    super({ id: "list", displayName: "List your reminders" });
  }

  protected override async onExecuteSlash({ user, ctx, commandName }: ExecuteContext) {
    const fetchPage = (page: number): Promise<Page<Reminder>> => reminderService.list(user.id, page);
    const firstPage = await fetchPage(1);

    if (firstPage.rows.length === 0) {
      return ctx.reply({
        embeds: [
          baseEmbed(commandName)
            .setTitle("⏰ Your Reminders")
            .setDescription("You have no reminders. Use `/reminder set` to add one."),
        ],
      });
    }

    const render = (page: Page<Reminder>) => {
      const lines = page.rows.map(
        reminder =>
          `**#${reminder.id}** · ${timestampLabel(reminder.remindAt, REMINDER_RELATIVE_WINDOW_MS)} · ${
            reminder.dm ? "DM" : `<#${reminder.channelId}>`
          }\n${reminder.about}`
      );
      return {
        embeds: [baseEmbed(commandName).setTitle("⏰ Your Reminders").setDescription(lines.join("\n\n"))],
      };
    };
    const response = await ctx.reply(render(firstPage));
    await attachPager(response, {
      namespace: "reminder-list",
      userId: ctx.user.id,
      page: firstPage,
      fetchPage,
      render,
    });
  }
}
