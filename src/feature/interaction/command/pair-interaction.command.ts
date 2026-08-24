import Command, { type ExecuteContext } from "../../../command/command";
import { userOption } from "../../../command/option";
import { getGif } from "../../../lib/anime";
import { baseEmbed } from "../../../lib/embed";
import { pluralize } from "../../../lib/utils";
import GlobalUsersManager from "../../../user/global-users-manager";
import { incrementInteraction, type InteractionType } from "../interactions";

/**
 * Base class for pair interactions: pick a target, increment the shared
 * interaction counter, and reply with a matching GIF from nekos.best.
 *
 * Subclasses only supply their id, description, interaction type, GIF category,
 * and the display verb and past participle used in the reply text.
 */
export default abstract class PairInteractionCommand extends Command {
  
  protected abstract readonly interactionType: InteractionType;
  protected abstract readonly gifCategory: Parameters<typeof getGif>[0];
  protected abstract readonly verb: string;
  protected abstract readonly pastParticiple: string;

  constructor(id: string, displayName: string) {
    super(id, displayName);
  }

  public override get options() {
    return [userOption(true, "target", `Who to ${this.interactionType}`)];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const target = args.user("target")!;
    if (target.id === globalUser.discordUser.id) {
      return ctx.reply(`You can't ${this.verb} yourself! :(`);
    }
    const targetUser = await GlobalUsersManager.getUser(target);
    const count = await incrementInteraction(globalUser.id, targetUser.id, this.interactionType);
    const gif = await getGif(this.gifCategory);
    const embed = baseEmbed()
      .setDescription(
        `**${globalUser.discordUser.displayName}** ${this.verb} **${target.displayName}**!
        ***${target.displayName}** has been **${this.pastParticiple}** by **${globalUser.discordUser.displayName}** **${pluralize("time", count)}**.*`
      )
      .setImage(gif.url);

    if (gif.anime_name) {
      embed.setFooter({ text: `Anime: ${gif.anime_name}` });
    }

    return ctx.reply({ embeds: [embed] });
  }
}
