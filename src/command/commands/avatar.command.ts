import { baseEmbed } from "../../lib/embed";
import Command, { type ExecuteContext } from "../command";
import { userOption } from "../option";

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

  protected override async onExecuteSlash({ globalUser, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("user") ?? globalUser.discordUser;
    const avatarUrl = target.displayAvatarURL({ size: 4096, extension: "webp" });

    const embed = baseEmbed(commandName).setTitle(`${target.displayName}'s Avatar`).setImage(avatarUrl);

    return ctx.reply({ embeds: [embed] });
  }
}
