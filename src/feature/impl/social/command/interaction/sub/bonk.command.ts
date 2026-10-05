import PairInteractionCommand from "../pair-interaction.command";

export default class BonkCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "bonk", displayName: "Bonk someone on the head" });
  }
  protected readonly interactionType = "bonk";
  protected readonly gifCategory = "bonk";
  protected readonly verb = "bonks";
  protected readonly emoji = "🥴";
}
