import type { Interaction } from "discord.js";
import Event from "../event";

/**
 * A message-component (button, select menu) or modal-submit interaction
 * was received. Posted by the event bridge for any interaction that is not
 * a chat-input or context-menu command; the settings listener routes these
 * to the component registry.
 */
export default class ComponentReceivedEvent extends Event {
  public readonly interaction: Interaction;

  constructor(interaction: Interaction) {
    super({
      guild: interaction.guild ?? null,
      userId: interaction.user?.id ?? null,
    });
    this.interaction = interaction;
  }
}
