import type { Interaction } from "discord.js";
import Event from "../event";

/**
 * A context menu (user/message) interaction was received.
 */
export default class ContextMenuReceivedEvent extends Event {
  public readonly interaction: Interaction;

  constructor(interaction: Interaction) {
    super({
      guild: interaction.guild ?? null,
      userId: interaction.user?.id ?? null,
    });
    this.interaction = interaction;
  }
}
