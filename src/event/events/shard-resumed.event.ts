import Event from "../event";

export default class ShardResumedEvent extends Event {
  public readonly shardId: number;
  public readonly replayedEvents: number;

  constructor(shardId: number, replayedEvents: number) {
    super();
    this.shardId = shardId;
    this.replayedEvents = replayedEvents;
  }
}
