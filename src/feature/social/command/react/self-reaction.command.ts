import Command, { type ExecuteContext } from "../../../../command/command";
import { getGif, type GifCategory } from "../../../../lib/anime";
import { baseEmbed } from "../../../../lib/embed";

/**
 * Base class for self-reactions: no options, the invoking user "acts on
 * themselves" and gets a matching GIF from nekos.best.
 *
 * Subclasses only supply their id, description, GIF category, and the
 * phrase that finishes the embed title, e.g. `... cries`.
 */
export default abstract class SelfReactionCommand extends Command {
  protected abstract readonly gifCategory: GifCategory;
  protected abstract readonly phrase: string;

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const gif = await getGif(this.gifCategory);
    const embed = baseEmbed(commandName).setTitle(`${ctx.user.displayName} ${this.phrase}`).setImage(gif.url);
    if (gif.anime_name) {
      embed.addFields({ name: "Anime", value: gif.anime_name, inline: true });
    }
    return ctx.reply({ embeds: [embed] });
  }
}
