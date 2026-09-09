import PairInteractionCommand from "../pair-interaction.command";

export default class TeaseCommand extends PairInteractionCommand {
  constructor() {
    super("tease", "Tease someone");
  }
  protected readonly interactionType = "tease";
  protected readonly gifCategory = "kabedon";
  protected readonly verb = "teases";
  protected readonly emoji = "😏";
}
