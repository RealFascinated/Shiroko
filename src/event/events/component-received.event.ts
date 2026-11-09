import type { ComponentInteraction } from "@/component/component";
import Event from "../event";

/**
 * Fired for any interaction that is not a chat-input or context-menu
 * command. One event type covers both components and modal submits: the
 * settings listener routes them to the same component registry.
 */
export default class ComponentReceivedEvent extends Event {
  public readonly interaction: ComponentInteraction;

  constructor(interaction: ComponentInteraction) {
    super({
      guild: interaction.guild ?? null,
      userId: interaction.user.id,
    });
    this.interaction = interaction;
  }
}
