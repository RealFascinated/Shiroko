import BotReadyEvent from "@/event/events/bot-ready.event";
import ComponentReceivedEvent from "@/event/events/component-received.event";
import { EventBus } from "@/event/event-bus";
import { EventHandler } from "@/event/event-handler";
import { EventListener } from "@/event/event-listener";
import type { Interaction } from "discord.js";
import type Component from "./component";
import { runComponentSweep } from "./component-sweep";
import { handleComponentInteraction } from "./router";

const SWEEP_CRON = "7 * * * *"; // hourly

type AnyComponent = Component<any>;

/**
 * The registry of stored components. A command registers its own on
 * construction, mirroring `PanelManager.register`; the listener routes every
 * component interaction to whichever component owns the custom id.
 *
 * Registering is code, so it exists again the moment the process boots. State
 * is not, which is why it lives in the row rather than here: a component
 * rendered before a restart is still answered afterwards.
 */
export default class ComponentManager extends EventListener {
  private static COMPONENTS: Map<string, AnyComponent> = new Map<string, AnyComponent>();

  private job: Bun.CronJob | undefined;

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  /**
   * Register a component. Its `componentId` is its custom-id segment and must
   * be unique across every component.
   */
  public static register(component: AnyComponent): void {
    if (ComponentManager.COMPONENTS.has(component.componentId)) {
      throw new Error(`Component "${component.componentId}" is already registered`);
    }
    ComponentManager.COMPONENTS.set(component.componentId, component);
  }

  public static get(componentId: string): AnyComponent | undefined {
    return ComponentManager.COMPONENTS.get(componentId);
  }

  /**
   * Route an interaction to its component when one owns the custom id, and
   * report whether it did. The panel router shares this event, so routing
   * must never assume it owns a press.
   */
  public static async route(interaction: Interaction): Promise<boolean> {
    return handleComponentInteraction(interaction, componentId => ComponentManager.get(componentId));
  }

  /**
   * Armed on ready, not at construction, so the sweep takes its `Client`
   * from the event; the previous job is stopped first so a second ready
   * cannot register a duplicate.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    this.job?.stop();
    this.job = Bun.cron(SWEEP_CRON, () => runComponentSweep(event.client), { tz: "UTC" });
  }

  @EventHandler(ComponentReceivedEvent)
  public async onComponentReceived(event: ComponentReceivedEvent): Promise<void> {
    await ComponentManager.route(event.interaction);
  }
}
