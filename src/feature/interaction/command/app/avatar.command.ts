import { ApplicationCommandType, type UserContextMenuCommandInteraction } from "discord.js";
import AppCommand, { type AppExecuteContext } from "../../../../command/app-command";
import { baseEmbed } from "../../../../lib/embed";

export default class AvatarCommand extends AppCommand {
  constructor() {
    super("avatar", "Show avatar");
  }

  protected override get commandType(): ApplicationCommandType.User {
    return ApplicationCommandType.User;
  }

  protected override async onExecute({ ctx }: AppExecuteContext): Promise<void> {
    const target = (ctx as UserContextMenuCommandInteraction).targetUser;
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "png" });

    const embed = baseEmbed()
      .setTitle(`${target.displayName}'s avatar`)
      .setImage(avatarUrl)
      .setFooter({ text: `User ID: ${target.id}` });

    await ctx.reply({ embeds: [embed] });
  }
}
