import Component, {
  componentCustomId,
  type ComponentContext,
  type ComponentType,
} from "@/component/component";
import { baseEmbed } from "@/lib/embed";
import GlobalUsersManager from "@/user/global-users-manager";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { birthdayService } from "./birthday.service";
import { BIRTHDAY_WISHES_LIST_COMPONENT_ID } from "./birthday-wish-list.component";

export type BirthdayWishPayload = {
  celebrantId: string;
  age: number;
};

export const BIRTHDAY_WISH_COMPONENT_ID = "birthday-wish";

export function birthdayEmbed({ celebrantId, age }: BirthdayWishPayload, wishes: number) {
  const wished =
    wishes > 0 ? `\n\n🎉 **${wishes}** ${wishes === 1 ? "person has" : "people have"} wished them well` : "";
  return baseEmbed("birthday")
    .setTitle("🎂 Happy Birthday!")
    .setDescription(`<@${celebrantId}> turns **${age}** today!${wished}`);
}

/**
 * The announcement's button row. Both buttons share the wish row, so the list
 * button reads the same wishes the wish button writes.
 */
export function wishRow(rowId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(componentCustomId(BIRTHDAY_WISH_COMPONENT_ID, rowId))
      .setLabel("Happy Birthday!")
      .setEmoji("🎂")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(componentCustomId(BIRTHDAY_WISHES_LIST_COMPONENT_ID, rowId))
      .setLabel("Recent wishes")
      .setEmoji("💌")
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * The "Wish them" button on a birthday announcement. Reusable, not one-shot:
 * every member presses it once, and the row's expiry (set where the
 * announcement is sent) is what ends the window.
 */
export default class BirthdayWishComponent extends Component<BirthdayWishPayload> {
  public readonly componentId: string = BIRTHDAY_WISH_COMPONENT_ID;
  public readonly type: ComponentType = "button";

  public async handle({ row, payload, interaction }: ComponentContext<BirthdayWishPayload>): Promise<void> {
    if (!interaction.isButton()) {
      return;
    }
    if (interaction.user.id === payload.celebrantId) {
      await interaction.reply({
        content: "You can't wish yourself, but happy birthday!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await GlobalUsersManager.getUser(interaction.user);
    const wishes = await birthdayService.wish(row.id, interaction.user.id);
    if (wishes === null) {
      await interaction.reply({ content: "You already sent your wishes.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.update({ embeds: [birthdayEmbed(payload, wishes)], components: [wishRow(row.id)] });
  }
}
