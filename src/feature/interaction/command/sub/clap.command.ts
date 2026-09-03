import PairInteractionCommand from "../pair-interaction.command";

export default class ClapCommand extends PairInteractionCommand {
  constructor() {
    super("clap", "Clap for someone");
  }
  protected readonly interactionType = "clap";
  protected readonly gifCategory = "clap";
  protected readonly verb = "claps for";
}
