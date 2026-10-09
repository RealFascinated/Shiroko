import type { ComponentSchema } from "@/db/schemas/components";
import type { JsonValue } from "@/db/schemas/guild-settings";
import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";

export type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

/**
 * The interaction kinds a row can gate on. A row stores the kind it was
 * created for, so a select's id can never be satisfied by a button press.
 */
export const COMPONENT_TYPES = ["button", "string-select", "modal"] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

/**
 * What a press happens in: the stored row, its decoded payload, and the
 * interaction itself.
 */
export interface ComponentContext<D extends JsonValue> {
  readonly row: ComponentSchema;
  readonly payload: D;
  readonly interaction: ComponentInteraction;
}

/**
 * The custom-id prefix every stored component carries. It is disjoint from
 * the panel prefix, so several routers can share the component event
 * without ever claiming each other's presses.
 */
export const COMPONENT_PREFIX = "component";

/**
 * A component attached to a message and driven by an event rather than a
 * callback: the id names the registered component, the row names the state.
 * The row is looked up on press, so a component keeps working after a
 * restart, and its behaviour re-reads stored state instead of trusting the
 * message it was rendered into.
 */
export default abstract class Component<D extends JsonValue = JsonValue> {
  /** Registry key, unique across every component. */
  public abstract readonly componentId: string;
  /** The interaction kind this component accepts. */
  public abstract readonly type: ComponentType;
  /**
   * Whether a press consumes the row. A one-shot row is claimed atomically
   * by the router, so exactly one press runs even under a race; a reusable
   * row (a pager, say) is read and left in place.
   */
  public readonly oneShot: boolean = false;
  public abstract handle(context: ComponentContext<D>): Promise<void>;
}

/** The custom id for one stored component. */
export function componentCustomId(componentId: string, rowId: string): string {
  return `${COMPONENT_PREFIX}:${componentId}:${rowId}`;
}

/**
 * Decode a component custom id, returning `null` when it does not belong to
 * the component system. Neither a component id nor a row id contains a
 * colon, so the parse is unambiguous.
 */
export function parseComponentCustomId(customId: string): { componentId: string; rowId: string } | null {
  const parts = customId.split(":");
  if (parts.length !== 3 || parts[0] !== COMPONENT_PREFIX) {
    return null;
  }
  const [, componentId, rowId] = parts;
  if (!componentId || !rowId) {
    return null;
  }
  return { componentId, rowId };
}
