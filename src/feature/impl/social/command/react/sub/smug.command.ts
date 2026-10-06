import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class SmugCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "smug", displayName: "Strut around all smug" });
  }
  protected readonly gifCategory: GifCategory = "smug";
  protected readonly phrase: string = "feels smug";
}
