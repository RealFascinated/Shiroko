import Command, { type ExecuteContext } from "@/command/command";
import { integerOption } from "@/command/option";
import { birthdayService } from "@/feature/impl/birthday/birthday.service";
import { ageInYears, isValidCalendarDate, isValidYear, monthName, todayUtc } from "@/lib/date";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { ordinal } from "@/lib/format";
import GlobalUsersManager from "@/user/global-users-manager";
import { MessageFlags } from "discord.js";

/**
 * Save (or replace) your own date of birth for this server. The reply is
 * ephemeral so the date is not broadcast, and there is no user option, so
 * nobody can set another member's birthday.
 */
export default class SetCommand extends Command {
  constructor() {
    super("set", "Save your birthday");
  }

  public override get options() {
    return [
      integerOption(true, "day", "Day of the month you were born", 1, 31),
      integerOption(true, "month", "Month you were born", 1, 12),
      integerOption(true, "year", "Year you were born", 1900, new Date().getUTCFullYear()),
    ];
  }

  protected override async onExecuteSlash({ user, ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const day = ctx.options.getInteger("day", true);
    const month = ctx.options.getInteger("month", true);
    const year = ctx.options.getInteger("year", true);

    if (!isValidYear(year)) {
      return ctx.reply(
        ephemeralErrorReply(commandName, errorEmbed(commandName).setDescription("That year is out of range."))
      );
    }
    if (!isValidCalendarDate(year, month, day)) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `**${monthName(month)} ${ordinal(day)}** is not a real date.`
          )
        )
      );
    }

    await GlobalUsersManager.getUser(user.discordUser);
    await birthdayService.setBirthday(guild.id, user.id, new Date(Date.UTC(year, month - 1, day)));

    const today = todayUtc();
    const isToday = today.month === month && today.day === day;
    const age = ageInYears(new Date(Date.UTC(year, month - 1, day)));
    const embed = baseEmbed(commandName)
      .setTitle("🎂 Birthday Saved")
      .setDescription(
        `Your birthday is set to **${monthName(month)} ${ordinal(day)}** (you are **${age}**).` +
          (isToday ? "\n\nSince that is today, it will be announced from next year." : "")
      );
    return ctx.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
