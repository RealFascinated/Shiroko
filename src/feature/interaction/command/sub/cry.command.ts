import PairInteractionCommand from "../pair-interaction.command";

export default class CryCommand extends PairInteractionCommand {
  constructor() {
    super("cry", "Cry in front of someone");
  }
  protected readonly interactionType = "cry";
  protected readonly gifCategory = "cry";
  protected readonly verb = "cries in front of";
}
