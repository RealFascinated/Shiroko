import "reflect-metadata";
import { EventBus, EventHandler, EventListener } from "./event";
import Event from "./event/event";

class TestEventA extends Event {
  public readonly value: string;
  constructor(value: string) {
    super({ userId: "u1", guild: null });
    this.value = value;
  }
}

class TestEventB extends Event {
  public readonly n: number;
  constructor(n: number) {
    super({ userId: "u2", guild: null });
    this.n = n;
  }
}

const seen: string[] = [];

class ListenerA extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }
  @EventHandler(TestEventA)
  public async onA(event: TestEventA): Promise<void> {
    seen.push(`A:${event.value}`);
  }
  @EventHandler(TestEventB)
  public async onB(event: TestEventB): Promise<void> {
    seen.push(`B:${event.n}`);
  }
}

class ListenerB2 extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }
  @EventHandler(TestEventA)
  public async onA2(event: TestEventA): Promise<void> {
    seen.push(`A2:${event.value}`);
  }
}

const a = new ListenerA();
const b = new ListenerB2();

await EventBus.post(new TestEventA("x"));
await EventBus.post(new TestEventB(5));

console.log("seen:", seen.join(","));
console.log("expect: A:x,A2:x,B:5");

if (seen.join(",") !== "A:x,A2:x,B:5") {
  throw new Error("dispatch mismatch");
}

EventBus.unsubscribe(a);
await EventBus.post(new TestEventA("y"));
console.log("after unsubscribe:", seen.join(","));
if (seen.join(",") !== "A:x,A2:x,B:5,A2:y") {
  throw new Error("unsubscribe mismatch");
}

console.log("BUS OK");
