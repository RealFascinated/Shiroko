import Command, { type CommandInfo } from "@/command/command";
import type { JsonValue } from "@/db/schemas/guild-settings";
import Component, { type ComponentContext, type ComponentType } from "./component";
import ComponentManager from "./index";

/**
 * A command that is also a component, so one class and one file own both the
 * command and the components attached to its replies. Registering happens on
 * construction, beside the command's own registration.
 *
 * The handler key is the command id, so a subcommand family sharing one base
 * class registers one component each instead of colliding on a constant, and
 * a press resolves to the exact subcommand that rendered the message.
 *
 * TypeScript has single inheritance, so this extends `Command` and carries
 * the `Component` contract rather than extending `Component` itself.
 */
export default abstract class ComponentCommand<D extends JsonValue = JsonValue>
  extends Command
  implements Component<D>
{
  public abstract readonly type: ComponentType;
  public abstract handle(context: ComponentContext<D>): Promise<void>;

  public readonly oneShot: boolean = false;

  /** The registry key and custom-id segment: the command's own id. */
  public get componentId(): string {
    return this.id;
  }

  constructor(info: CommandInfo) {
    super(info);
    ComponentManager.register(this);
  }
}
