import Command, { type ExecuteContext } from "@/command/command";
import {
  reminderService,
  REMINDER_RELATIVE_WINDOW_MS,
  type Reminder,
} from "@/feature/impl/reminders/reminder.service";
import { baseEmbed } from "@/lib/embed";
import { replyPaged, type Page } from "@/lib/pagination";
import { timestampLabel } from "@/lib/time";

export default class ListCommand extends Command {
  constructor() {
    super({ id: "list", displayName: "List your reminders" });
  }

  protected override async onExecuteSlash({ user, ctx, commandName }: ExecuteContext) {
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
    return replyPaged(ctx, {
      namespace: "reminder-list",
      fetchPage: page => reminderService.list(user.id, page),
      render,
      empty: {
        embeds: [
          baseEmbed(commandName)
            .setTitle("⏰ Your Reminders")
            .setDescription("You have no reminders. Use `/reminder set` to add one."),
        ],
      },
    });
  }
}
