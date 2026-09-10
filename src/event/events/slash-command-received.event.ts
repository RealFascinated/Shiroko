import type { Interaction } from "discord.js";
import Event from "../event";

/**
 * A chat-input (slash) command interaction was received.
 */
export default class SlashCommandReceivedEvent extends Event {
  public readonly interaction: Interaction;

  constructor(interaction: Interaction) {
    super({
      guild: interaction.guild ?? null,
      userId: interaction.user?.id ?? null,
    });
    this.interaction = interaction;
  }
}
