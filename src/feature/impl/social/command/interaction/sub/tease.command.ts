import PairInteractionCommand from "../pair-interaction.command";

export default class TeaseCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "tease", displayName: "Tease someone" });
  }
  protected readonly interactionType = "tease";
  protected readonly gifCategory = "kabedon";
  protected readonly verb = "teases";
  protected readonly emoji = "😏";
}
