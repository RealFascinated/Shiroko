import PairInteractionCommand from "../pair-interaction.command";

export default class WinkCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "wink", displayName: "Wink at someone" });
  }
  protected readonly interactionType = "wink";
  protected readonly gifCategory = "wink";
  protected readonly verb = "winks at";
  protected readonly emoji = "😉";
}
