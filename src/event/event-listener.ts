/**
 * Base class for event listeners. Subclasses declare `@EventHandler`
 * methods; register them on the bus by calling `EventBus.subscribe(this)`
 * (usually in the constructor).
 */
export default abstract class EventListener {
  /**
   * Remove this listener's handlers from the bus.
   */
  public unsubscribe(): void {
    // Registration happens via EventBus.subscribe(this) in the constructor;
    // removal is EventBus.unsubscribe(this). Kept as an override point.
  }
}

export { EventListener };
