import PairInteractionCommand from "../pair-interaction.command";

export default class HoldhandsCommand extends PairInteractionCommand {
  constructor() {
    super("holdhands", "Hold someone's hand");
  }
  protected readonly interactionType = "holdhands";
  protected readonly gifCategory = "handhold";
  protected readonly verb = "holds hands with";
  protected readonly pastParticiple = "held hands with";
}