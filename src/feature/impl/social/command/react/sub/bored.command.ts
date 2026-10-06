import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class BoredCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "bored", displayName: "Express your boredom" });
  }
  protected readonly gifCategory: GifCategory = "bored";
  protected readonly phrase: string = "is bored";
}
