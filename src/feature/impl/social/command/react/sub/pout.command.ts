import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class PoutCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "pout", displayName: "Express a pouty mood" });
  }
  protected readonly gifCategory: GifCategory = "pout";
  protected readonly phrase: string = "pouts";
}
