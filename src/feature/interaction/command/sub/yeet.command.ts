import PairInteractionCommand from "../pair-interaction.command";

export default class YeetCommand extends PairInteractionCommand {
  constructor() {
    super("yeet", "Yeet someone");
  }
  protected readonly interactionType = "yeet";
  protected readonly gifCategory = "yeet";
  protected readonly verb = "yeets";
}
