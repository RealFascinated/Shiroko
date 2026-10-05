import SelfReactionCommand from "../self-reaction.command";

export default class LaughCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "laugh", displayName: "Let out a good laugh" });
  }
  protected readonly gifCategory = "laugh";
  protected readonly phrase = "laughs";
}
