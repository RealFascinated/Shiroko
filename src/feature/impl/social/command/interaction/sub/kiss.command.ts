import PairInteractionCommand from "../pair-interaction.command";

export default class KissCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "kiss", displayName: "Kiss someone" });
  }
  protected readonly interactionType = "kiss";
  protected readonly gifCategory = "kiss";
  protected readonly verb = "kisses";
  protected readonly emoji = "😘";
}
