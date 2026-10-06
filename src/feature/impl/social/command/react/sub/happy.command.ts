import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class HappyCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "happy", displayName: "Show off your happiness" });
  }
  protected readonly gifCategory: GifCategory = "happy";
  protected readonly phrase: string = "is happy";
}
