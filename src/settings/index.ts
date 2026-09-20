import { type Guild } from "discord.js";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import ComponentReceivedEvent from "../event/events/component-received.event";
import GuildFeatures from "../feature/guild-features";
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

  /**
   * Every module whose feature is enabled in the guild (feature-less
   * modules are always enabled). Shared by `/settings` and the component
   * registry so the panel's category dropdown only ever lists live
   * modules.
   */
  public static async enabledModules(guild: Guild): Promise<SettingsModule<any>[]> {
    const enabled: SettingsModule<any>[] = [];
    for (const module of SettingsManager.all()) {
      const on = module.featureId === null || (await GuildFeatures.isFeatureEnabled(guild, module.featureId));
      if (on) {
        enabled.push(module);
      }
    }
    return enabled;
  }

  @EventHandler(ComponentReceivedEvent)
  public async onComponentReceived(event: ComponentReceivedEvent): Promise<void> {
    await ComponentRegistry.handle(event.interaction);
  }
}
