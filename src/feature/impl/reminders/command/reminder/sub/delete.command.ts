import Command, { type ExecuteContext } from "@/command/command";
import { integerOption } from "@/command/option";
import { reminderService } from "@/feature/impl/reminders/reminder.service";
import { baseEmbed, errorEmbed } from "@/lib/embed";

/**
 * Delete one of your own reminders by id. A reminder belonging to someone
 * else reports the same "no reminder" as a missing one, so the command
 * cannot be used to probe for other members' reminders.
 */
export default class DeleteCommand extends Command {
  constructor() {
    super({ id: "delete", displayName: "Delete one of your reminders" });
  }

  public override get options() {
    return [integerOption(true, "id", "The reminder id, from /reminder list", 1)];
  }

  protected override async onExecuteSlash({ user, ctx, commandName }: ExecuteContext) {
    const id = ctx.options.getInteger("id", true);
    if (!(await reminderService.remove(id, user.id))) {
      return ctx.reply({
        embeds: [
          errorEmbed(commandName).setDescription(`You have no reminder **#${id}**. See \`/reminder list\`.`),
        ],
      });
    }

    const embed = baseEmbed(commandName)
      .setTitle("⏰ Reminder Deleted")
      .setDescription(`Removed reminder **#${id}**.`);
    return ctx.reply({ embeds: [embed] });
  }
}
