import { SlashCommandBuilder } from "discord.js";
import type { CommandInteraction, Guild, InteractionResponse, User } from "discord.js";

export default abstract class Command {
  public readonly id: string;
  public readonly displayName: string;
  public readonly slashCommand: SlashCommandBuilder;

  constructor(id: string, displayName: string) {
    this.id = id;
    this.displayName = displayName;
    this.slashCommand = new SlashCommandBuilder().setName(id).setDescription(displayName);
  }

  public async executeSlash(
    user: User,
    guild: Guild,
    ctx: CommandInteraction
  ): Promise<InteractionResponse<boolean>> {
    throw new Error("executeSlash must be overridden by a subclass");
  }
}
