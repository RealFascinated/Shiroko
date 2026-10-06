import { EventBus } from "@/event/event-bus";
import { EventHandler } from "@/event/event-handler";
import { EventListener } from "@/event/event-listener";
import ComponentReceivedEvent from "@/event/events/component-received.event";
import type { Interaction } from "discord.js";
import type Panel from "./panel";
import { handlePanelInteraction } from "./router";

/**
 * The registry of configuration panels. A feature registers its panel in
 * its constructor, mirroring `SettingsManager.register`; the listener
 * routes component interactions to whichever panel owns the custom id.
 *
 * A panel is not feature-gated here: a panel can legitimately outlive its
 * feature toggle (someone opens it, the feature is turned off, the message
 * is still on screen). Gating belongs in the panel's own `access` when the
 * action is per-user.
 */
export default class PanelManager extends EventListener {
  private static PANELS: Map<string, Panel<any>> = new Map<string, Panel<any>>();

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  /**
   * Register a panel. Its `segment` is its custom-id namespace and must be
   * unique across every panel.
   */
  public static register(panel: Panel<any>): void {
    if (PanelManager.PANELS.has(panel.segment)) {
      throw new Error(`Panel segment "${panel.segment}" is already registered`);
    }
    PanelManager.PANELS.set(panel.segment, panel);
    console.log(`Registered panel: ${panel.segment} - ${panel.title}`);
  }

  public static get(segment: string): Panel<any> | undefined {
    return PanelManager.PANELS.get(segment);
  }

  public static all(): Panel<any>[] {
    return Array.from(PanelManager.PANELS.values());
  }

  /**
   * Route an interaction to its panel when one owns the custom id, and
   * report whether it did. Several listeners can share the component
   * event, so routing must never assume it owns a press.
   */
  public static async route(interaction: Interaction): Promise<boolean> {
    return handlePanelInteraction(interaction, segment => PanelManager.get(segment));
  }

  @EventHandler(ComponentReceivedEvent)
  public async onComponentReceived(event: ComponentReceivedEvent): Promise<void> {
    await PanelManager.route(event.interaction);
  }
}
