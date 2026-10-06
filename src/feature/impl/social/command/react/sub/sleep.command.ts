import SelfReactionCommand from "../self-reaction.command";
import type { GifCategory } from "@/lib/anime/index";

export default class SleepCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "sleep", displayName: "Doze off right there" });
  }
  protected readonly gifCategory: GifCategory = "sleep";
  protected readonly phrase: string = "falls asleep";
}
