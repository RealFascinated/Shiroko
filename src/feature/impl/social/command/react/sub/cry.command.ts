import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class CryCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "cry", displayName: "Have a little cry" });
  }
  protected readonly gifCategory: GifCategory = "cry";
  protected readonly phrase: string = "cries";
}
