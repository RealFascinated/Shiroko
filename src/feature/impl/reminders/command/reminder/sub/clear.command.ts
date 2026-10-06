import Command, { type ExecuteContext } from "@/command/command";
import { reminderService } from "@/feature/impl/reminders/reminder.service";
import { baseEmbed, errorEmbed } from "@/lib/embed";
import { pluralise } from "@/lib/format";

/**
 * Delete every reminder you have. Bounded to the caller's own rows, so the
 * count in the reply is the whole receipt and no confirmation is needed.
 */
export default class ClearCommand extends Command {
  constructor() {
    super({ id: "clear", displayName: "Delete all of your reminders" });
  }

  protected override async onExecuteSlash({ user, ctx, commandName }: ExecuteContext) {
    const count = await reminderService.clear(user.id);
    if (count === 0) {
      return ctx.reply({
        embeds: [errorEmbed(commandName).setDescription("You have no reminders.")],
      });
    }

    const embed = baseEmbed(commandName)
      .setTitle("⏰ Reminders Cleared")
      .setDescription(`Deleted ${count} ${pluralise(count, "reminder")}.`);
    return ctx.reply({ embeds: [embed] });
  }
}
