import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class ShockedCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "shocked", displayName: "Express your shock" });
  }
  protected readonly gifCategory: GifCategory = "shocked";
  protected readonly phrase: string = "is shocked";
}
