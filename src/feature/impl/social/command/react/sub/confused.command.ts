import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class ConfusedCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "confused", displayName: "Express your confusion" });
  }
  protected readonly gifCategory: GifCategory = "confused";
  protected readonly phrase: string = "is confused";
}
