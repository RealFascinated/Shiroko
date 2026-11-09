import Command, { type ExecuteContext } from "@/command/command";
import type { SelfReactionDefinition } from "@/feature/impl/social/reactions";
import { getGif, type GifCategory } from "@/lib/anime/index";
import { baseEmbed } from "@/lib/embed";

/**
 * Base class for self-reactions: no options, the invoking user "acts on
 * themselves" and gets a matching GIF from nekos.best.
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

/** One subcommand of `/react`, built from its row in `SELF_REACTIONS`. */
export class SelfReactionSubCommand extends SelfReactionCommand {
  protected readonly gifCategory: GifCategory;
  protected readonly phrase: string;

  constructor(definition: SelfReactionDefinition) {
    super({ id: definition.id, displayName: definition.displayName });
    this.gifCategory = definition.gifCategory;
    this.phrase = definition.phrase;
  }
}
