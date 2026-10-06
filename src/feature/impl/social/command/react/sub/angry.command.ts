import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class AngryCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "angry", displayName: "Show off your anger" });
  }
  protected readonly gifCategory: GifCategory = "angry";
  protected readonly phrase: string = "is angry";
}
