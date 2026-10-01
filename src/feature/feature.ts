import type Command from "../command/command";
import { EventBus } from "../event/event-bus";
import { EventListener } from "../event/event-listener";
import { FeatureIds } from "./feature-ids";

type FeatureOptions = {
  defaultEnabled?: boolean;
  toggleable?: boolean;
  name?: string;
  emoji?: string;
};

/**
 * A bot feature: an id used for per-guild toggles, its user-facing name and
 * emoji, an optional default, and the commands it owns. Event behavior lives
 * in `@EventHandler` listeners (see `src/event/`), not here.
 */
export default class Feature extends EventListener {
  private static REGISTRY = new Map<FeatureIds, Feature>();

  public readonly id: FeatureIds;
  public readonly options: Required<FeatureOptions>;
  public readonly name: string;
  public readonly emoji: string;
  public readonly toggleable: boolean;

  public commands: Command[] = [];

  constructor(id: FeatureIds, options: FeatureOptions = {}) {
    super();
    EventBus.subscribe(this);
    this.id = id;
    this.options = { defaultEnabled: true, toggleable: true, name: id, emoji: "⚙️", ...options };
    this.name = this.options.name;
    this.emoji = this.options.emoji;
    this.toggleable = this.options.toggleable;
    Feature.REGISTRY.set(id, this);
  }

  public static get(featureId: FeatureIds): Feature | undefined {
    return Feature.REGISTRY.get(featureId);
  }

  /**
   * Every registered feature, in registration order.
   */
  public static all(): Feature[] {
    return [...Feature.REGISTRY.values()];
  }

  public registerCommand(command: Command): void {
    command.featureId = this.id;
    this.commands.push(command);
    // Dynamic import breaks the static cycle: `command/index.ts` imports
    // feature commands, which import `GuildFeatures` → `feature.ts`.
    void import("../command/index").then(({ default: CommandManager }) => {
      CommandManager.registerCommand(command);
    });
  }
}
