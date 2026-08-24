import Command, { type ExecuteContext } from "../../../../command/command";
import { EmbedBuilder } from "discord.js";
import { userOption } from "../../../../command/option";
import { getGif } from "../../../../lib/anime";
import { Constants } from "../../../../constants";

export default class PatCommand extends Command {
  constructor() {
    super("pat", "Pat someone");
  }

  public override get options() {
    return [userOption(true, "target", "Who to pat")];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const target = args.user("target")!;
    if (target.id === globalUser.discordUser.id) {
      return ctx.reply("You can't pat yourself! :(");
    }
    const interactionProfile = await globalUser.getInteractionsProfile();
    interactionProfile.pats.set(target.id, (interactionProfile.pats.get(target.id) ?? 0) + 1);
    interactionProfile.markDirty();

    const count = interactionProfile.pats.get(target.id) ?? 0;
    const gif = await getGif("pat");
    const embed = new EmbedBuilder()
      .setDescription(
        `**${globalUser.discordUser.displayName}** pats **${target.displayName}**!
        ***${target.displayName}** has been **patted** by **${globalUser.discordUser.displayName}** **${count} times**.*`
      )
      .setImage(gif.url)
      .setColor(Constants.mainColor);

    if (gif.anime_name) {
      embed.setFooter({ text: `Anime: ${gif.anime_name}` });
    }

    return ctx.reply({ embeds: [embed] });
  }
}
