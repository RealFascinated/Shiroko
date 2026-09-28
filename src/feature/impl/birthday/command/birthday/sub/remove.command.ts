import { MessageFlags } from "discord.js";
import Command, { type ExecuteContext } from "../../../../../../command/command";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../../../../lib/embed";
import { ordinal } from "../../../../../../lib/format";
import { birthdayService } from "../../../birthday.service";
import { monthName } from "../../../date";

/**
 * Clear your stored birthday for this server, and drop the birthday role
 * immediately if you currently hold it.
 */
export default class RemoveCommand extends Command {
  constructor() {
    super("remove", "Remove your saved birthday");
  }

  protected override async onExecuteSlash({ user, guild, ctx, commandName }: ExecuteContext) {
    if (!guild) {
      return;
    }
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
