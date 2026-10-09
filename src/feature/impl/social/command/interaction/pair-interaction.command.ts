import { type CommandInfo, type ExecuteContext } from "@/command/command";
import { userOption } from "@/command/option";
import ComponentCommand from "@/component/component-command";
import { componentCustomId, type ComponentContext, type ComponentType } from "@/component/component";
import Components from "@/component/components";
import SocialService, { type InteractionType } from "@/feature/impl/social/social.service";
import { getGif, type AnimeGif } from "@/lib/anime/index";
import { baseEmbed } from "@/lib/embed";
import { ordinal, titleCase } from "@/lib/format";
import { TimeUnit } from "@/lib/time";
import GlobalUsersManager from "@/user/global-users-manager";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";

const BACK_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Hour, 12);

/**
 * What the back button needs that it cannot re-derive from the message: the
 * actor to return the interaction to. Everything else is the command's own
 * state, so it is read from the registered command rather than stored.
 */
type InteractionBackPayload = { actorId: string; commandName: string };

/**
 * Base class for pair interactions: pick a target, increment the shared
 * interaction counter, reply with a matching GIF from nekos.best, and offer
 * a "… back!" button the target can press to return the interaction.
 *
 * The button is a stored component rather than a collector, so it keeps
 * working across a restart. Its row names the target as the only allowed
 * presser and is claimed on the press, so the interaction is returned once.
 *
 * Subclasses only supply their id, description, interaction type, GIF category,
 * and the display verb and past participle used in the reply text.
 */
export default abstract class PairInteractionCommand extends ComponentCommand<InteractionBackPayload> {
  public readonly type: ComponentType = "button";
  public override readonly oneShot: boolean = true;

  protected abstract readonly interactionType: InteractionType;
  protected abstract readonly gifCategory: Parameters<typeof getGif>[0];
  protected abstract readonly verb: string;
  protected abstract readonly emoji: string;

  constructor(info: CommandInfo) {
    super(info);
  }

  public override get options() {
    return [userOption(true, "target", `Who to ${this.interactionType}`)];
  }

  protected override async onExecuteSlash({ user, ctx, commandName }: ExecuteContext) {
    const target = ctx.options.getUser("target", true);
    if (target.id === user.discordUser.id) {
      return ctx.reply({ content: `You can't ${this.verb} yourself! :(`, flags: MessageFlags.Ephemeral });
    }
    const targetUser = await GlobalUsersManager.getUser(target);
    const count = await SocialService.incrementInteraction(user.id, targetUser.id, this.interactionType);
    const gif = await getGif(this.gifCategory);
    const embed = this.buildEmbed(commandName, user.id, target.id, count, gif);

    const response = await ctx.reply({ embeds: [embed] });
    const component = await Components.create({
      guildId: ctx.guildId,
      channelId: response.interaction.channelId,
      messageId: response.id,
      userId: target.id,
      type: this.type,
      extraData: { actorId: user.id, commandName },
      expiresAt: new Date(Date.now() + BACK_WINDOW_MS),
    });
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentCustomId(this.componentId, component.id))
        .setLabel(`${titleCase(this.interactionType)} Back!`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(this.emoji)
    );
    await ctx.editReply({ components: [row] });

    return response;
  }

  public async handle({ payload, interaction }: ComponentContext<InteractionBackPayload>): Promise<void> {
    if (!interaction.isButton()) {
      return;
    }
    await interaction.update({ components: [] });

    const presser = await GlobalUsersManager.getUser(interaction.user);
    const count = await SocialService.incrementInteraction(presser.id, payload.actorId, this.interactionType);
    const gif = await getGif(this.gifCategory);
    const embed = this.buildEmbed(payload.commandName, presser.id, payload.actorId, count, gif);
    await interaction.followUp({ embeds: [embed] });
  }

  private buildEmbed(
    commandName: string,
    actorId: string,
    recipientId: string,
    count: number,
    gif: AnimeGif
  ): EmbedBuilder {
    const embed = baseEmbed(commandName)
      .setDescription(`<@${actorId}> ${this.verb} <@${recipientId}> for the **${ordinal(count)}** time!`)
      .setImage(gif.url);
    if (gif.anime_name) {
      embed.addFields({ name: "Anime", value: gif.anime_name, inline: true });
    }
    return embed;
  }
}
