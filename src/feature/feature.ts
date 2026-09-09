import type { Client, ClientEvents, Guild } from "discord.js";
import CommandManager from "../command";
import type Command from "../command/command";
import { extractGuildFromArgs } from "../lib/guild";
import GuildFeatures from "./guild-features";

export enum FeatureIds {
  Interaction = "interaction",
  Invites = "invites",
  Stats = "stats",
}

type FeatureOptions = {
  defaultEnabled?: boolean;
};

type AnyEventListener = (...args: any[]) => void | Promise<void>;

export default class Feature {
  private static REGISTRY = new Map<FeatureIds, Feature>();

  public readonly id: FeatureIds;
  public readonly options: FeatureOptions;

  public commands: Command[] = [];
  private eventListeners: Array<{
    event: keyof ClientEvents;
    listener: AnyEventListener;
    extractGuild: (...args: any[]) => Guild | null | undefined;
  }> = [];

  constructor(
    id: FeatureIds,
    options: FeatureOptions = {
      defaultEnabled: true,
    }
  ) {
    this.id = id;
    this.options = options;
    Feature.REGISTRY.set(id, this);
  }

  /**
   * Look up a registered feature by id.
   */
  public static get(featureId: FeatureIds): Feature | undefined {
    return Feature.REGISTRY.get(featureId);
  }

  /**
   * Register a slash command owned by this feature.
   */
  public registerCommand(command: Command): void {
    command.featureId = this.id;
    this.commands.push(command);
    CommandManager.registerCommand(command);
  }

  /**
   * Store a client event listener owned by this feature. Listeners attach
   * when `registerHandlers` runs. `extractGuild` selects the guild used for
   * the per-guild toggle; return `undefined` for global events that always run.
   */
  public registerEventListener<T extends keyof ClientEvents>(
    event: T,
    listener: (...args: ClientEvents[T]) => void | Promise<void>,
    extractGuild?: (...args: ClientEvents[T]) => Guild | null | undefined
  ): void {
    this.eventListeners.push({
      event,
      listener: listener as AnyEventListener,
      extractGuild: (extractGuild ?? extractGuildFromArgs) as (...args: any[]) => Guild | null | undefined,
    });
  }

  /**
   * Attach every stored event listener to `client`.
   */
  public registerHandlers(client: Client): void {
    for (const { event, listener, extractGuild } of this.eventListeners) {
      client.on(event, async (...args: any[]) => {
        try {
          const guild = extractGuild(...args);
          if (guild !== undefined && guild !== null) {
            const isFeatureEnabled = await GuildFeatures.isFeatureEnabled(guild, this.id);
            if (!isFeatureEnabled) {
              return;
            }
          }
          await listener(...args);
        } catch (error) {
          console.error(`Error in ${this.id} feature event listener for ${event}:`, error);
        }
      });
    }
  }
}
