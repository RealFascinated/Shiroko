import PairInteractionCommand from "../pair-interaction.command";

export default class DanceCommand extends PairInteractionCommand {
  constructor() {
    super("dance", "Dance with someone");
  }
  protected readonly interactionType = "dance";
  protected readonly gifCategory = "dance";
  protected readonly verb = "dances with";
}