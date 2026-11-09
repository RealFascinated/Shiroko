import Event from "../event";

export default class ShardReconnectingEvent extends Event {
  public readonly shardId: number;

  constructor(shardId: number) {
    super();
    this.shardId = shardId;
  }
}
