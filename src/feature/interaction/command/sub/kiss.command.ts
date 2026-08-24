import Command, { type ExecuteContext } from "../../../../command/command";
import { userOption } from "../../../../command/option";
import { getGif } from "../../../../lib/anime";
import { baseEmbed } from "../../../../lib/embed";
import { pluralize } from "../../../../lib/utils";
import GlobalUsersManager from "../../../../user/global-users-manager";
import { incrementInteraction } from "../../interactions";

export default class KissCommand extends Command {
  constructor() {
    super("kiss", " Kiss someone");
  }

  public override get options() {
    return [userOption(true, "target", "Who to kiss")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const target = args.user("target")!;
    if (target.id === globalUser.discordUser.id) {
      return ctx.reply("You can't kiss yourself! :(");
    }
    const targetUser = await GlobalUsersManager.getUser(target);
    const count = await incrementInteraction(globalUser.id, targetUser.id, "kiss");
    const gif = await getGif("kiss");
    const embed = baseEmbed()
      .setDescription(
        `**${globalUser.discordUser.displayName}** kisses **${target.displayName}**!
        ***${target.displayName}** has been **kissed** by **${globalUser.discordUser.displayName}** **${pluralize("time", count)}**.*`
      )
      .setImage(gif.url);

    if (gif.anime_name) {
      embed.setFooter({ text: `Anime: ${gif.anime_name}` });
    }

    return ctx.reply({ embeds: [embed] });
  }
}
