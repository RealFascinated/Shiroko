import Command, { type ExecuteContext } from "@/command/command";
import { birthdayService } from "@/feature/impl/birthday/birthday.service";
import { monthName } from "@/feature/impl/birthday/date";
import { baseEmbed } from "@/lib/embed";
import { ordinal } from "@/lib/format";

/**
 * List the next ten birthdays in the server, soonest first, with today's
 * celebrations called out.
 */
export default class UpcomingCommand extends Command {
  constructor() {
    super("upcoming", "Show the next 10 birthdays in this server");
  }

  protected override async onExecuteSlash({ guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const memberIds = new Set(guild.members.cache.keys());
    const upcoming = await birthdayService.upcoming(guild.id, memberIds);
    const embed = baseEmbed(commandName).setTitle(`🎂 Upcoming Birthdays: ${guild.name}`);

    if (upcoming.length === 0) {
      return ctx.reply({
        embeds: [embed.setDescription("No birthdays saved yet. Use `/birthday set` to add yours.")],
      });
    }

    const lines = upcoming.map(entry => {
      const when =
        entry.inDays === 0 ? "**Today!**" : `in ${entry.inDays} day${entry.inDays === 1 ? "" : "s"}`;
      return `<@${entry.userId}> - ${monthName(entry.month)} ${ordinal(entry.day)} (${when})`;
    });
    return ctx.reply({ embeds: [embed.setDescription(lines.join("\n"))] });
  }
}
