import PairInteractionCommand from "../pair-interaction.command";

export default class HighfiveCommand extends PairInteractionCommand {
  constructor() {
    super("highfive", "High five someone");
  }
  protected readonly interactionType = "highfive";
  protected readonly gifCategory = "highfive";
  protected readonly verb = "high-fives";
}
