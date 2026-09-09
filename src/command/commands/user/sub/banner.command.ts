import Command, { type ExecuteContext } from "../../../../command/command";
import { userOption } from "../../../../command/option";
import { baseEmbed } from "../../../../lib/embed";

export default class BannerCommand extends Command {
  constructor() {
    super("banner", "Show a user's profile banner");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [userOption(false, "user", "Whose banner to show")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args, commandName }: ExecuteContext) {
    const target = await (args.user("user") ?? globalUser.discordUser).fetch();
    const bannerUrl = target.bannerURL({ size: 4096, extension: "webp" });

    if (!bannerUrl) {
      const embed = baseEmbed(commandName)
        .setTitle(`${target.displayName}'s Banner`)
        .setDescription("No banner set");

      return ctx.reply({ embeds: [embed] });
    }

    const embed = baseEmbed(commandName).setTitle(`${target.displayName}'s Banner`).setImage(bannerUrl);

    return ctx.reply({ embeds: [embed] });
  }
}
