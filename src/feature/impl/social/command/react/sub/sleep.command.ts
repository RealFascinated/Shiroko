import SelfReactionCommand from "../self-reaction.command";

export default class SleepCommand extends SelfReactionCommand {
  constructor() {
    super("sleep", "Doze off right there");
  }
  protected readonly gifCategory = "sleep";
  protected readonly phrase = "falls asleep";
}
