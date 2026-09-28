import Command, { type ExecuteContext } from "@/command/command";
import { userOption } from "@/command/option";
import { birthdayService } from "@/feature/impl/birthday/birthday.service";
import { daysUntil, monthName, todayUtc } from "@/feature/impl/birthday/date";
import { baseEmbed } from "@/lib/embed";
import { ordinal, pluralise } from "@/lib/format";

/**
 * Show the birthday one member has saved in this server, defaulting to
 * the caller. Public, like `upcoming`: only the month and day are shown,
 * never the birth year.
 */
export default class ViewCommand extends Command {
  constructor() {
    super("view", "Show a saved birthday");
  }

  public override get options() {
    return [userOption(false, "user", "Whose birthday to show (defaults to you)")];
  }

  protected override async onExecuteSlash({ user, guild, ctx, args, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
    const target = args.user("user") ?? user.discordUser;
    const birthday = await birthdayService.getBirthday(guild.id, target.id);
    const embed = baseEmbed(commandName).setTitle(`🎂 ${target.displayName}'s Birthday`);

    if (!birthday) {
      const who = target.id === user.id ? "You have" : `${target} has`;
      return ctx.reply({ embeds: [embed.setDescription(`${who} not saved a birthday in this server.`)] });
    }

    const date = `**${monthName(birthday.month)} ${ordinal(birthday.day)}**`;
    const today = todayUtc();
    const inDays = daysUntil(birthday.month, birthday.day);
    const summary =
      today.month === birthday.month && today.day === birthday.day
        ? "That is **today!**"
        : `That is in ${inDays} ${pluralise(inDays, "day")}.`;
    return ctx.reply({ embeds: [embed.setDescription(`${target}'s birthday is ${date}. ${summary}`)] });
  }
}
