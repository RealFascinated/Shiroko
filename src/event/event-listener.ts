/**
 * Base class for event listeners. Subclasses declare `@EventHandler`
 * methods; register them on the bus by calling `EventBus.subscribe(this)`
 * (usually in the constructor).
 */
export abstract class EventListener {
}
