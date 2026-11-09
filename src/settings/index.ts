import { type Guild } from "discord.js";
import GuildFeatures from "../feature/guild-features";
import type SettingsModule from "./settings-module";

/**
 * The settings subsystem entry: a static registry of settings modules.
 * Features register their module in their feature constructor via
 * {@link SettingsManager.register}, mirroring `registerCommand`. The
 * `/settings` command opens the hub panel, which is routed through the
 * generic panel engine, so this class no longer handles component
 * interactions itself.
 */
export default class SettingsManager {
  private static MODULES: Map<string, SettingsModule<any>> = new Map<string, SettingsModule<any>>();
  private static UNLISTED: Set<string> = new Set<string>();

  /**
   * Register a module so its stored keys resolve to labels (the audit log
   * reads them through {@link SettingsManager.get}). `listed: false` keeps
   * it out of `/settings`, for a feature that renders its own panel.
   */
  public static register(module: SettingsModule<any>, options: { listed?: boolean } = {}): void {
    SettingsManager.MODULES.set(module.id, module);
    if (options.listed === false) {
      SettingsManager.UNLISTED.add(module.id);
    }
    console.log(`Registered settings module: ${module.id} - ${module.displayName}`);
  }

  public static get(id: string): SettingsModule<any> | undefined {
    return SettingsManager.MODULES.get(id);
  }

  public static all(): SettingsModule<any>[] {
    return Array.from(SettingsManager.MODULES.values()).filter(
      module => !SettingsManager.UNLISTED.has(module.id)
    );
  }

  /**
   * Every module whose feature is enabled in the guild (feature-less
   * modules are always enabled). `/settings` shows only these as views, so
   * a category disappears the moment its feature is disabled.
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
}
