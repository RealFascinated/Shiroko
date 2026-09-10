import type Command from "../command/command";
import { FeatureIds } from "./feature-ids";

export { FeatureIds };

type FeatureOptions = {
  defaultEnabled?: boolean;
};

/**
 * A bot feature: an id used for per-guild toggles, optional default,
 * and the commands it owns. Event behavior lives in `@EventHandler`
 * listeners (see `src/event/`), not here.
 */
export default class Feature {
  private static REGISTRY = new Map<FeatureIds, Feature>();

  public readonly id: FeatureIds;
  public readonly options: FeatureOptions;

  public commands: Command[] = [];

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
    // Dynamic import breaks the static cycle: `command/index.ts` imports
    // feature commands, which import `GuildFeatures` → `feature.ts`.
    void import("../command").then(({ default: CommandManager }) => {
      CommandManager.registerCommand(command);
    });
  }
}
