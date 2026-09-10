import type { FeatureIds } from "../feature/feature-ids";
import type Event from "./event";

/**
 * Declarative listener registration, mirroring Orbit's `@EventHandler`.
 * Decorate a method on an {@link EventListener} subclass; the bus dispatches
 * the given event class to it.
 *
 * Standard decorators can't read the parameter type at runtime (no
 * `emitDecoratorMetadata` in this project), so the event class is passed
 * explicitly, which also reads clearly at the call site:
 *
 * ```ts
 * @EventHandler(MessageCreatedEvent)
 * public async onMessageCreated(event: MessageCreatedEvent): Promise<void> { ... }
 * ```
 *
 * Optionally gate the listener behind a feature: the bus checks
 * `GuildFeatures.isFeatureEnabled(event.guild, featureId)` before dispatch.
 */
export function EventHandler<T extends Event>(
  eventClass: new (...args: any[]) => T,
  options: { featureId?: FeatureIds } = {}
): (value: (event: T) => void | Promise<void>, context: ClassMethodDecoratorContext) => void {
  return (value, context) => {
    if (context.kind !== "method") {
      throw new Error(`@EventHandler can only decorate methods (got ${context.kind})`);
    }
    Reflect.defineMetadata(
      "event:handler",
      {
        method: String(context.name),
        eventClass,
        featureId: options.featureId ?? null,
      },
      value
    );
  };
}
