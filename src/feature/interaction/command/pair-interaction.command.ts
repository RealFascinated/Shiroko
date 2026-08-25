import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionResponse,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import Command, { type ExecuteContext } from "../../../command/command";
import { userOption } from "../../../command/option";
import { getGif, type AnimeGif } from "../../../lib/anime";
import { remainingMs } from "../../../lib/cooldown/cooldowns";
import { baseEmbed, watchButtonPress } from "../../../lib/embed";
import { TimeUnit } from "../../../lib/time";
import { pluralize } from "../../../lib/utils";
import GlobalUsersManager from "../../../user/global-users-manager";
import { interactionConfig } from "../config";
import { startInteractionCooldown } from "../cooldowns";
import { incrementInteraction, type InteractionType } from "../interactions";

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
  protected abstract readonly pastParticiple: string;

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
   * the invoking command for the footer and `count` seeds the tally line.
   */
  private buildEmbed(
    commandName: string,
    actor: { displayName: string },
    recipient: { displayName: string },
    count: number,
    gif: AnimeGif
  ) {
    const embed = baseEmbed(commandName)
      .setDescription(
        `**${actor.displayName}** ${this.verb} **${recipient.displayName}**!` +
          `\n*${recipient.displayName} has been **${this.pastParticiple}** by ` +
          `**${actor.displayName}** **${pluralize("time", count)}**.*`
      )
      .setImage(gif.url);
    if (gif.anime_name) {
      embed.addFields({ name: "Anime", value: gif.anime_name, inline: true });
    }
    return embed;
  }

  protected override async onExecuteSlash({ globalUser, ctx, args, commandName }: ExecuteContext) {
    const target = args.user("target")!;
    if (target.id === globalUser.discordUser.id) {
      return ctx.reply(`You can't ${this.verb} yourself! :(`);
    }
    const targetUser = await GlobalUsersManager.getUser(target);
    const count = await incrementInteraction(globalUser.id, targetUser.id, this.interactionType);
    const gif = await getGif(this.gifCategory);
    const embed = this.buildEmbed(commandName, globalUser.discordUser, target, count, gif);

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(backButtonId(this.interactionType))
        .setLabel(`${this.interactionType} back!`)
        .setStyle(ButtonStyle.Secondary)
    );
    const response = await ctx.reply({ embeds: [embed], components: [row] });

    if (response instanceof InteractionResponse) {
      await watchButtonPress(response, {
        customId: backButtonId(this.interactionType),
        userId: target.id,
        windowMs: interactionConfig.backButtonWindowMs,
        onPress: button => this.returnInteraction(button, globalUser.discordUser.id, commandName),
      });
    }

    return response;
  }

  /**
   * Return the interaction to the original actor: enforce the per-user
   * cooldown, count the reverse direction, and post a matching result card.
   */
  private async returnInteraction(
    button: ButtonInteraction,
    actorId: string,
    commandName: string
  ): Promise<void> {
    const cd = await startInteractionCooldown(
      button.user.id,
      `back:${this.interactionType}`,
      interactionConfig.backButtonCooldownMs
    );
    if (!cd.ok) {
      const secs = Math.ceil(remainingMs(cd.cooldown.endsAt) / TimeUnit.toMillis(TimeUnit.Second, 1));
      await button.followUp(`You already returned that. Try again in ${pluralize("second", secs)}.`);
      return;
    }

    const targetUser = await GlobalUsersManager.getUser(button.user);
    const count = await incrementInteraction(targetUser.id, actorId, this.interactionType);
    const gif = await getGif(this.gifCategory);
    const embed = this.buildEmbed(commandName, targetUser.discordUser, button.user, count, gif);
    await button.followUp({ embeds: [embed] });
  }
}
