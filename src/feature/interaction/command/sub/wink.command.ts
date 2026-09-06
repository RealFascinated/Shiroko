import PairInteractionCommand from "../pair-interaction.command";

export default class WinkCommand extends PairInteractionCommand {
  constructor() {
    super("wink", "Wink at someone");
  }
  protected readonly interactionType = "wink";
  protected readonly gifCategory = "wink";
  protected readonly verb = "winks at";
  protected readonly emoji = "😉";
}
