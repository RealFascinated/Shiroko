import type { Interaction } from "discord.js";
import Event from "../event";

/**
 * Fired for any interaction that is not a chat-input or context-menu
 * command. One event type covers both components and modal submits: the
 * settings listener routes them to the same component registry.
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
