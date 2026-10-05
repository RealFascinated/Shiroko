import Command, { type ExecuteContext } from "@/command/command";
import { birthdayService } from "@/feature/impl/birthday/birthday.service";
import { monthName } from "@/lib/date";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { ordinal } from "@/lib/format";
import { MessageFlags } from "discord.js";

/**
 * Clear your stored birthday for this server, and drop the birthday role
 * immediately if you currently hold it.
 */
export default class RemoveCommand extends Command {
  constructor() {
    super({ id: "remove", displayName: "Remove your saved birthday" });
  }

  protected override async onExecuteSlash({ user, ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const existing = await birthdayService.getBirthday(guild.id, user.id);
    if (!existing) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("You have not saved a birthday in this server.")
        )
      );
    }

    await birthdayService.removeBirthday(guild.id, user.id);
    await birthdayService.stripRole(guild, user.id);

    const embed = baseEmbed(commandName)
      .setTitle("🎂 Birthday Removed")
      .setDescription(`Cleared your birthday (**${monthName(existing.month)} ${ordinal(existing.day)}**).`);
    return ctx.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
