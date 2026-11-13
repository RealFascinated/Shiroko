import Component, { type ComponentContext, type ComponentType } from "@/component/component";
import Components from "@/component/components";
import { baseEmbed } from "@/lib/embed";
import { marriageService } from "./marriage.service";

export type MarriageResponsePayload = { proposerId: string; accept: boolean };

export const MARRIAGE_RESPONSE_COMPONENT_ID = "marriage-response";

/**
 * The accept and decline buttons on a proposal. Each is a one-shot row that
 * only the proposed member may press; a press drops the sibling row too.
 */
export default class MarriageResponseComponent extends Component<MarriageResponsePayload> {
  public readonly componentId: string = MARRIAGE_RESPONSE_COMPONENT_ID;
  public readonly type: ComponentType = "button";
  public override readonly oneShot: boolean = true;

  public async handle({
    row,
    payload,
    interaction,
  }: ComponentContext<MarriageResponsePayload>): Promise<void> {
    if (!interaction.isButton()) {
      return;
    }
    await Components.deleteByMessage(row.messageId);
    const guildId = row.guildId!;
    const embed = baseEmbed("marriage").setTitle("💍 Marriage");
    const targetId = interaction.user.id;
    let description = `<@${targetId}> declined <@${payload.proposerId}>'s proposal.`;
    if (payload.accept) {
      description = (await marriageService.marry(guildId, payload.proposerId, targetId))
        ? `🎉 <@${payload.proposerId}> and <@${targetId}> are now married!`
        : "One of you is already married in this server, so the proposal could not go through.";
    }
    await interaction.update({
      content: `<@${payload.proposerId}>`,
      embeds: [embed.setDescription(description)],
      components: [],
    });
  }
}
