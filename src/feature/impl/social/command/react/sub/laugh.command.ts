import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class LaughCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "laugh", displayName: "Let out a good laugh" });
  }
  protected readonly gifCategory: GifCategory = "laugh";
  protected readonly phrase: string = "laughs";
}
