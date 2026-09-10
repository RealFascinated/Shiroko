import Command, { type ExecuteContext } from "../../../../command/command";
import { userOption } from "../../../../command/option";
import { baseEmbed } from "../../../../lib/embed";

export default class AvatarCommand extends Command {
  constructor() {
    super("avatar", "Show a user's profile avatar");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [userOption(false, "user", "Whose avatar to show")];
  }

  protected override async onExecuteSlash({ user, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("user") ?? user.discordUser;
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "webp" });

    const embed = baseEmbed(commandName).setTitle(`${target.displayName}'s Avatar`).setImage(avatarUrl);

    return ctx.reply({ embeds: [embed] });
  }
}
