import type { MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from "discord.js";
import Event from "../event";

export default class ContextMenuReceivedEvent extends Event {
  public readonly interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction;

  constructor(
    interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction
  ) {
    super({
      guild: interaction.guild ?? null,
      userId: interaction.user.id,
    });
    this.interaction = interaction;
  }
}
