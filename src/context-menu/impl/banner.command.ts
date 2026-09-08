import { ApplicationCommandType, type UserContextMenuCommandInteraction } from "discord.js";
import { baseEmbed } from "../../lib/embed";
import ContextMenuCommand, { type ContextMenuExecuteContext } from "../context-menu-command";

export default class BannerCommand extends ContextMenuCommand {
  constructor() {
    super("banner", "Show banner");
  }

  protected override get commandType(): ApplicationCommandType.User {
    return ApplicationCommandType.User;
  }

  protected override async onExecute({ ctx }: ContextMenuExecuteContext): Promise<void> {
    const target = await (ctx as UserContextMenuCommandInteraction).targetUser.fetch();
    const bannerUrl = target.bannerURL({ size: 4096, extension: "webp" });

    if (!bannerUrl) {
      const embed = baseEmbed().setTitle(`${target.displayName}'s Banner`).setDescription("No banner set");

      await ctx.reply({ embeds: [embed] });
      return;
    }

    const embed = baseEmbed().setTitle(`${target.displayName}'s Banner`).setImage(bannerUrl);

    await ctx.reply({ embeds: [embed] });
  }
}
