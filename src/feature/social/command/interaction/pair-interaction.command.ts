import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionResponse,
  MessageFlags,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
  type User,
} from "discord.js";
import SocialFeature, { type InteractionType } from "../..";
import Command, { type ExecuteContext } from "../../../../command/command";
import { userOption } from "../../../../command/option";
import { getGif, type AnimeGif } from "../../../../lib/anime";
import { baseEmbed, watchButtonPress } from "../../../../lib/embed";
import { ordinal, titleCase } from "../../../../lib/format";
import { TimeUnit } from "../../../../lib/time";
import GlobalUsersManager from "../../../../user/global-users-manager";

/** Discriminator for this test command, e.g. `interaction-back:hug`. */
const BACK_BUTTON_PREFIX = "interaction-back";

/** Format a dynamic custom id we can parse back on press: `interaction-back:<type>`. */
function backButtonId(interactionType: InteractionType): string {
  return `${BACK_BUTTON_PREFIX}:${interactionType}`;
}

/**
 * Base class for pair interactions: pick a target, increment the shared
 * interaction counter, reply with a matching GIF from nekos.best, and offer
 * a "… back!" button the target can press to return the interaction.
 *
 * Subclasses only supply their id, description, interaction type, GIF category,
 * and the display verb and past participle used in the reply text.
 */
export default abstract class PairInteractionCommand extends Command {
  protected abstract readonly interactionType: InteractionType;
  protected abstract readonly gifCategory: Parameters<typeof getGif>[0];
  protected abstract readonly verb: string;
  protected abstract readonly emoji: string;
  constructor(id: string, displayName: string) {
    super(id, displayName);
  }

  public override get options() {
    return [userOption(true, "target", `Who to ${this.interactionType}`)];
  }

  /**
   * Build the result-card embed for one side of this interaction.
   *
   * `actor` performed the interaction on `recipient`; `commandName` names
   * the invoking command for the footer and `count` seeds the ordinal tally.
   * Each user is mentioned exactly once.
   */
  private buildEmbed(commandName: string, actor: User, recipient: User, count: number, gif: AnimeGif) {
    const embed = baseEmbed(commandName)
      .setDescription(`${actor} ${this.verb} ${recipient} for the **${ordinal(count)}** time!`)
      .setImage(gif.url);
    if (gif.anime_name) {
      embed.addFields({ name: "Anime", value: gif.anime_name, inline: true });
    }
    return embed;
  }

  protected override async onExecuteSlash({ globalUser, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("target")!;
    if (target.id === globalUser.discordUser.id) {
      return ctx.reply({ content: `You can't ${this.verb} yourself! :(`, flags: MessageFlags.Ephemeral });
    }
    const targetUser = await GlobalUsersManager.getUser(target);
    const count = await SocialFeature.incrementInteraction(
      globalUser.id,
      targetUser.id,
      this.interactionType
    );
    const gif = await getGif(this.gifCategory);
    const embed = this.buildEmbed(commandName, globalUser.discordUser, target, count, gif);

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(backButtonId(this.interactionType))
        .setLabel(`${titleCase(this.interactionType)} Back!`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(this.emoji)
    );
    const response = await ctx.reply({ embeds: [embed], components: [row] });

    if (response instanceof InteractionResponse) {
      await watchButtonPress(response, {
        customId: backButtonId(this.interactionType),
        userId: target.id,
        windowMs: TimeUnit.toMillis(TimeUnit.Hour, 3),
        onPress: button => this.returnInteraction(button, globalUser.discordUser, commandName),
      });
    }

    return response;
  }

  /**
   * Return the interaction to the original actor: count the reverse
   * direction and post a matching result card. The button itself was
   * already removed by `watchButtonPress`, so this runs at most once.
   */
  private async returnInteraction(
    button: ButtonInteraction,
    originalActor: User,
    commandName: string
  ): Promise<void> {
    const presserUser = await GlobalUsersManager.getUser(button.user);
    const count = await SocialFeature.incrementInteraction(
      presserUser.id,
      originalActor.id,
      this.interactionType
    );
    const gif = await getGif(this.gifCategory);
    const embed = this.buildEmbed(commandName, presserUser.discordUser, originalActor, count, gif);
    await button.followUp({ embeds: [embed] });
  }
}
