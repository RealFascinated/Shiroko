import type { ComponentSchema } from "@/db/schemas/components";
import type { Interaction } from "discord.js";
import Component, { parseComponentCustomId, type ComponentContext } from "./component";
import Components from "./components";

type AnyComponent = Component<any>;

/**
 * Route an interaction to its component, returning `true` when the component
 * system owned the press. Everything the press needs is read at press time:
 * the custom id names the component, the row names the state and the user
 * allowed to press it, and the component's own code decides what to do. No
 * part of a press lives in process memory, so a message rendered before a
 * restart still answers.
 *
 * The component is erased to `Component<any>` here on purpose: a registry
 * cannot know a component's payload type, and every payload crossing this
 * boundary came from that component's own row. The `any` is contained to
 * this boundary and never reaches a component implementation.
 */
export async function handleComponentInteraction(
  interaction: Interaction,
  resolve: (componentId: string) => AnyComponent | undefined
): Promise<boolean> {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) {
    return false;
  }
  const decoded = parseComponentCustomId(interaction.customId);
  if (!decoded) {
    return false;
  }
  const component = resolve(decoded.componentId);
  if (!component) {
    return false;
  }
  // A one-shot is claimed by the delete, so a double press runs its handler
  // once; a reusable row is read and left in place for the next press.
  const row = component.oneShot
    ? await Components.consume(decoded.rowId)
    : await Components.find(decoded.rowId);
  if (!row || !matches(component, row, interaction)) {
    return false;
  }
  try {
    const context: ComponentContext<any> = { row, payload: row.extraData, interaction };
    await component.handle(context);
  } catch (error) {
    console.error(`Error handling component "${interaction.customId}":`, error);
  }
  return true;
}

/**
 * Whether a stored row may answer this press: the same guild (or none, for a
 * DM reply), the interaction kind the row was created for, and the row's own
 * user when it names one.
 */
function matches(component: AnyComponent, row: ComponentSchema, interaction: Interaction): boolean {
  if (row.guildId !== (interaction.guildId ?? null)) {
    return false;
  }
  if (row.type !== component.type) {
    return false;
  }
  return row.userId === null || row.userId === interaction.user.id;
}
