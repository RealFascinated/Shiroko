import { baseEmbed } from "@/lib/embed";
import { ApplicationCommandType, type UserContextMenuCommandInteraction } from "discord.js";
import ContextMenuCommand, { type ContextMenuExecuteContext } from "../context-menu-command";

export default class AvatarCommand extends ContextMenuCommand {
  constructor() {
    super("avatar", "Show Avatar");
  }

  protected override get commandType(): ApplicationCommandType.User {
    return ApplicationCommandType.User;
  }

  protected override async onExecute({ ctx }: ContextMenuExecuteContext): Promise<void> {
    const target = (ctx as UserContextMenuCommandInteraction).targetUser;
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "webp" });

    const embed = baseEmbed().setTitle(`${target.displayName}'s Avatar`).setImage(avatarUrl);

    await ctx.reply({ embeds: [embed] });
  }
}
