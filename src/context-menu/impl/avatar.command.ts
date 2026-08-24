import { ApplicationCommandType, type UserContextMenuCommandInteraction } from "discord.js";
import { baseEmbed } from "../../lib/embed";
import ContextMenuCommand, { type ContextMenuExecuteContext } from "../context-menu-command";

export default class AvatarCommand extends ContextMenuCommand {
  constructor() {
    super("avatar", "Show avatar");
  }

  protected override get commandType(): ApplicationCommandType.User {
    return ApplicationCommandType.User;
  }

  protected override async onExecute({ ctx }: ContextMenuExecuteContext): Promise<void> {
    const target = (ctx as UserContextMenuCommandInteraction).targetUser;
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "webp" });

    const embed = baseEmbed()
      .setTitle(`${target.displayName}'s avatar`)
      .setImage(avatarUrl)
      .setFooter({ text: `User ID: ${target.id}` });

    await ctx.reply({ embeds: [embed] });
  }
}
