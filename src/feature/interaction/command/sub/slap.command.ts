import Command, { type ExecuteContext } from "../../../../command/command";
import { EmbedBuilder } from "discord.js";
import { userOption } from "../../../../command/option";
import { getGif } from "../../../../lib/anime";
import { Constants } from "../../../../constants";
import { pluralize } from "../../../../lib/utils";
export default class SlapCommand extends Command {
  constructor() {
    super("slap", "Slap someone");
  }

  public override get options() {
    return [userOption(true, "target", "Who to slap")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const target = args.user("target")!;
    if (target.id === globalUser.discordUser.id) {
      return ctx.reply("You can't slap yourself! :(");
    }
    const interactionProfile = await globalUser.getInteractionsProfile();
    interactionProfile.slaps.set(target.id, (interactionProfile.slaps.get(target.id) ?? 0) + 1);
    interactionProfile.markDirty();

    const count = interactionProfile.slaps.get(target.id) ?? 0;
    const gif = await getGif("slap");
    const embed = new EmbedBuilder()
      .setDescription(
        `**${globalUser.discordUser.displayName}** slaps **${target.displayName}**!
        ***${target.displayName}** has been **slapped** by **${globalUser.discordUser.displayName}** **${pluralize("time", count)}**.*`
      )
      .setImage(gif.url)
      .setColor(Constants.mainColor);

    if (gif.anime_name) {
      embed.setFooter({ text: `Anime: ${gif.anime_name}` });
    }

    return ctx.reply({ embeds: [embed] });
  }
}
