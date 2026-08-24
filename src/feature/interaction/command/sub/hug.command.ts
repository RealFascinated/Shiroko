import { baseEmbed } from "../../../../lib/embed";
import Command, { type ExecuteContext } from "../../../../command/command";
import { userOption } from "../../../../command/option";
import { getGif } from "../../../../lib/anime";
import { pluralize } from "../../../../lib/utils";
import { incrementInteraction } from "../../interactions";
import GlobalUsersManager from "../../../../user/global-users-manager";

export default class HugCommand extends Command {
  constructor() {
    super("hug", "Give someone a big hug");
  }

  public override get options() {
    return [userOption(true, "target", "Who to hug")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const target = args.user("target")!;
    if (target.id === globalUser.discordUser.id) {
      return ctx.reply("You can't hug yourself! :(");
    }
    const targetUser = await GlobalUsersManager.getUser(target);
    const count = await incrementInteraction(globalUser.id, targetUser.id, "hug");
    const gif = await getGif("hug");
    const embed = baseEmbed()
      .setDescription(
        `**${globalUser.discordUser.displayName}** hugs **${target.displayName}**!
        ***${target.displayName}** has been **hugged** by **${globalUser.discordUser.displayName}** **${pluralize("time", count)}**.*`
      )
      .setImage(gif.url);

    if (gif.anime_name) {
      embed.setFooter({ text: `Anime: ${gif.anime_name}` });
    }

    return ctx.reply({ embeds: [embed] });
  }
}
