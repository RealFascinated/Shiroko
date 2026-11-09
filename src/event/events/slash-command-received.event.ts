import type { ChatInputCommandInteraction } from "discord.js";
import Event from "../event";

export default class SlashCommandReceivedEvent extends Event {
  public readonly interaction: ChatInputCommandInteraction;

  constructor(interaction: ChatInputCommandInteraction) {
    super({
      guild: interaction.guild ?? null,
      userId: interaction.user.id,
    });
    this.interaction = interaction;
  }
}
