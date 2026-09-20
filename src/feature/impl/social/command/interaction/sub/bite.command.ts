import PairInteractionCommand from "../pair-interaction.command";

export default class BiteCommand extends PairInteractionCommand {
  constructor() {
    super("bite", "Bite someone");
  }
  protected readonly interactionType = "bite";
  protected readonly gifCategory = "bite";
  protected readonly verb = "bites";
  protected readonly emoji = "🦷";
}
