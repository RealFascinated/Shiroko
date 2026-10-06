import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class BlehCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "bleh", displayName: "Express your displeasure with a bleh anime gif" });
  }
  protected readonly gifCategory: GifCategory = "bleh";
  protected readonly phrase: string = "feels bleh";
}
