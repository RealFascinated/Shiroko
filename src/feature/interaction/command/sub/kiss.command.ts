import { baseEmbed } from "../../../../lib/embed";
import Command, { type ExecuteContext } from "../../../../command/command";
import { userOption } from "../../../../command/option";
import { getGif } from "../../../../lib/anime";
import { pluralize } from "../../../../lib/utils";
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
    const interactionProfile = await globalUser.getInteractionsProfile();
    interactionProfile.kisses.set(target.id, (interactionProfile.kisses.get(target.id) ?? 0) + 1);
    interactionProfile.markDirty();

    const count = interactionProfile.kisses.get(target.id) ?? 0;
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
