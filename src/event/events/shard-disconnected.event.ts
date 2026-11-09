import Event from "../event";

export default class ShardDisconnectedEvent extends Event {
  public readonly shardId: number;
  public readonly code: number;

  constructor(shardId: number, code: number) {
    super();
    this.shardId = shardId;
    this.code = code;
  }
}
