import Component, { type ComponentContext, type ComponentType } from "@/component/component";
import { baseEmbed } from "@/lib/embed";
import { discordTimestamp } from "@/lib/time";
import { MessageFlags } from "discord.js";
import { birthdayService } from "./birthday.service";
import type { BirthdayWishPayload } from "./birthday-wish.component";

export const BIRTHDAY_WISHES_LIST_COMPONENT_ID = "birthday-wish-list";

const RECENT_WISHES = 15;

/**
 * The "Recent wishes" button beside the wish button. Read-only and reusable:
 * it lists the newest wishes on the announcement and leaves the row alone.
 */
export default class BirthdayWishesListComponent extends Component<BirthdayWishPayload> {
  public readonly componentId: string = BIRTHDAY_WISHES_LIST_COMPONENT_ID;
  public readonly type: ComponentType = "button";

  public async handle({ row, interaction }: ComponentContext<BirthdayWishPayload>): Promise<void> {
    if (!interaction.isButton()) {
      return;
    }
    const wishes = await birthdayService.recentWishes(row.id, RECENT_WISHES);
    const description =
      wishes.length === 0
        ? "Nobody has wished them well yet."
        : wishes.map(wish => `<@${wish.wisherId}> ${discordTimestamp(wish.createdAt)}`).join("\n");
    await interaction.reply({
      embeds: [baseEmbed("birthday").setTitle("💌 Recent wishes").setDescription(description)],
      flags: MessageFlags.Ephemeral,
    });
  }
}
