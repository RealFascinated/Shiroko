import { baseEmbed } from "../../lib/embed";
import Command, { type ExecuteContext } from "../command";
import { userOption } from "../option";

export default class AvatarCommand extends Command {
  constructor() {
    super("avatar", "Show avatar");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [userOption(false, "user", "Whose avatar to show")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const target = args.user("user") ?? globalUser.discordUser;
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "png" });

    const embed = baseEmbed()
      .setTitle(`${target.displayName}'s avatar`)
      .setImage(avatarUrl)
      .setFooter({ text: `User ID: ${target.id}` });

    return ctx.reply({ embeds: [embed] });
  }
}
