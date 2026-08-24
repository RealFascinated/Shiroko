import Command, { type ExecuteContext } from "../../../../command/command";
import { EmbedBuilder } from "discord.js";
import { userOption } from "../../../../command/option";
import { getGif } from "../../../../lib/anime";
import { pluralize } from "../../../../lib/utils";
import { Constants } from "../../../../constants";

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
    const interactionProfile = await globalUser.getInteractionsProfile();
    interactionProfile.hugs += 1;
    interactionProfile.markDirty();

    const gif = await getGif("hug");
    const embed = new EmbedBuilder()
      .setDescription(
        `**${globalUser.discordUser.displayName}** hugs **${target.displayName}**!
        ***${target.displayName}** has received **${pluralize("hug", interactionProfile.hugs)}**.*`
      )
      .setImage(gif.url)
      .setColor(Constants.mainColor);

    if (gif.anime_name) {
      embed.setFooter({ text: `Anime: ${gif.anime_name}` });
    }

    return ctx.reply({ embeds: [embed] });
  }
}
