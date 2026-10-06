import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class BlushCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "blush", displayName: "Get all flustered" });
  }
  protected readonly gifCategory: GifCategory = "blush";
  protected readonly phrase: string = "blushes";
}
