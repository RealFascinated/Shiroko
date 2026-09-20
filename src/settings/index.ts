import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import ComponentReceivedEvent from "../event/events/component-received.event";
import ComponentRegistry from "./component/component-registry";
import type SettingsModule from "./settings-module";

/**
 * The settings subsystem entry: a registry of settings modules (static)
 * plus the listener that routes message-component and modal-submit
 * interactions to the settings panel's component registry. Instantiate
 * once in `src/index.ts`; features register their module in their feature
 * constructor via {@link SettingsManager.register}, mirroring
 * `registerCommand`.
 */
export default class SettingsManager extends EventListener {
  private static MODULES = new Map<string, SettingsModule<any>>();

  constructor() {
    super();
    EventBus.subscribe(this);
  }

  /**
   * Register a settings module. `/settings` and the component registry
   * look modules up by id.
   */
  public static register(module: SettingsModule<any>): void {
    SettingsManager.MODULES.set(module.id, module);
    console.log(`Registered settings module: ${module.id} - ${module.displayName}`);
  }

  public static get(id: string): SettingsModule<any> | undefined {
    return SettingsManager.MODULES.get(id);
  }

  public static all(): SettingsModule<any>[] {
    return Array.from(SettingsManager.MODULES.values());
  }

  @EventHandler(ComponentReceivedEvent)
  public async onComponentReceived(event: ComponentReceivedEvent): Promise<void> {
    await ComponentRegistry.handle(event.interaction);
  }
}
