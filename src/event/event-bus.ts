import type { Guild } from "discord.js";
import "reflect-metadata";
import type { FeatureIds } from "../feature/feature-ids";
import GuildFeatures from "../feature/guild-features";
import type Event from "./event";
import type EventListener from "./event-listener";

/** Metadata attached to a listener class by `@EventHandler`. */
export interface HandlerMetadata {
  method: string;
  eventClass: new (...args: any[]) => Event;
  featureId: FeatureIds | null;
}

type AnyHandler = (event: Event) => void | Promise<void>;

interface HandlerEntry {
  listener: EventListener;
  method: string;
  handler: AnyHandler;
  featureId: FeatureIds | null;
  priority: number;
}

const BUS_HANDLERS = new Map<new (...args: any[]) => Event, HandlerEntry[]>();

/**
 * The internal event bus, modeled on Meteor's Orbit. Listeners register
 * `@EventHandler` methods on classes extending {@link EventListener};
 * the bus dispatches each posted event to every handler for its class, in
 * registration order within a priority tier. Feature gating is applied per
 * handler via `@EventHandler({ featureId })`.
 *
 * Dispatch is synchronous: each handler's returned promise is awaited
 * before the next handler runs, so bus post calls are `await`able and
 * state changes (e.g. derived events) happen in order.
 */
export default class EventBus {
  private static readonly HANDLERS = BUS_HANDLERS;

  /**
   * Register a listener instance: every `@EventHandler` method it owns
   * becomes a handler on the bus.
   */
  public static subscribe(listener: EventListener): void {
    const handlers = EventBus.listenerHandlers(listener);
    for (const metadata of handlers) {
      const method = listener[metadata.method as keyof EventListener] as
        ((event: Event) => void | Promise<void>) | undefined;
      if (typeof method !== "function") {
        throw new Error(
          `EventListener "${listener.constructor.name}" declares @EventHandler for ${metadata.method} but the method does not exist`
        );
      }
      const key = metadata.eventClass as new (...args: any[]) => Event;
      const entries = EventBus.HANDLERS.get(key) ?? [];
      entries.push({
        listener,
        method: metadata.method,
        // Bind so `this` is the listener instance at dispatch time
        // (standard decorators don't autobind).
        handler: method.bind(listener) as AnyHandler,
        featureId: metadata.featureId,
        priority: 0,
      });
      EventBus.HANDLERS.set(key, entries);
    }
  }

  /**
   * Remove a listener instance's handlers from the bus.
   */
  public static unsubscribe(listener: EventListener): void {
    const handlers = EventBus.listenerHandlers(listener);
    for (const metadata of handlers) {
      const key = metadata.eventClass as new (...args: any[]) => Event;
      const entries = EventBus.HANDLERS.get(key);
      if (!entries) {
        continue;
      }
      EventBus.HANDLERS.set(
        key,
        entries.filter(entry => entry.listener !== listener)
      );
    }
  }

  /**
   * Resolve the `@EventHandler` metadata for a listener instance: walk the
   * prototype chain and collect metadata attached to each decorated method
   * function (standard decorators attach metadata to the function value).
   */
  public static listenerHandlers(listener: EventListener): HandlerMetadata[] {
    const handlers: HandlerMetadata[] = [];
    let proto: object | null = Object.getPrototypeOf(listener);
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        if (!desc || typeof desc.value !== "function") {
          continue;
        }
        const metadata = Reflect.getMetadata("event:handler", desc.value) as HandlerMetadata | undefined;
        if (metadata) {
          handlers.push(metadata);
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    return handlers;
  }

  /**
   * Dispatch `event` to every handler subscribed for its class.
   */
  public static async post(event: Event): Promise<void> {
    const entries = EventBus.HANDLERS.get(event.constructor as new (...args: any[]) => Event) ?? [];
    const sorted = [...entries].sort((a, b) => b.priority - a.priority);
    for (const entry of sorted) {
      if (!(await EventBus.gate(entry, event))) {
        continue;
      }
      await entry.handler(event);
    }
  }

  /**
   * Feature-gate a handler: when the handler declares a `featureId`, the
   * event's guild must have the feature enabled. Listeners without a
   * featureId always run.
   */
  private static async gate(entry: HandlerEntry, event: Event): Promise<boolean> {
    if (!entry.featureId) {
      return true;
    }
    const guild: Guild | null = event.guild;
    if (!guild) {
      return true;
    }
    return GuildFeatures.isFeatureEnabled(guild, entry.featureId);
  }
}

export { EventBus };
