import PairInteractionCommand from "../pair-interaction.command";

export default class SlapCommand extends PairInteractionCommand {
  constructor() {
    super("slap", "Slap someone");
  }
  protected readonly interactionType = "slap";
  protected readonly gifCategory = "slap";
  protected readonly verb = "slaps";
  protected readonly emoji = "💥";
}
