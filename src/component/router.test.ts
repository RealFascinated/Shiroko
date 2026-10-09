import type { ComponentSchema } from "@/db/schemas/components";
import { beforeEach, describe, expect, test } from "bun:test";
import type { Interaction } from "discord.js";
import Component, { componentCustomId, type ComponentContext, type ComponentType } from "./component";
import Components from "./components";
import { handleComponentInteraction } from "./router";

/** A component recording every press it handled. */
class RecordingComponent extends Component<{ note: string }> {
  public readonly componentId: string = "rec";
  public readonly type: ComponentType = "button";
  public override readonly oneShot: boolean = true;
  public readonly handled: Array<ComponentContext<{ note: string }>> = [];

  public async handle(context: ComponentContext<{ note: string }>): Promise<void> {
    this.handled.push(context);
  }
}

/** A reusable component, the shape a pager takes: the row survives a press. */
class ReusableComponent extends RecordingComponent {
  public override readonly oneShot: boolean = false;
}

function storedRow(overrides: Partial<ComponentSchema> = {}): ComponentSchema {
  return {
    id: "row-1",
    guildId: "g",
    channelId: "c",
    messageId: "m",
    userId: "7",
    type: "button",
    extraData: { note: "hello" },
    createdAt: new Date(0),
    expiresAt: null,
    ...overrides,
  };
}

/** An interaction stub exposing only what the router reads. */
function stubInteraction(overrides: Record<string, unknown>): Interaction {
  return {
    customId: componentCustomId("rec", "row-1"),
    guildId: "g",
    user: { id: "7" },
    isButton: () => true,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    ...overrides,
  } as unknown as Interaction;
}

/**
 * The router reads the row from the store; stub it so no database is touched.
 * `consume` mirrors the real one-shot claim by clearing what it returns.
 */
let stored: ComponentSchema | null = null;

beforeEach(() => {
  stored = storedRow();
  Components.find = async () => stored;
  Components.consume = async () => {
    const row = stored;
    stored = null;
    return row;
  };
});

function route(component: Component<any>, interaction: Interaction): Promise<boolean> {
  return handleComponentInteraction(interaction, id =>
    id === component.componentId ? component : undefined
  );
}

describe("component routing", () => {
  test("ignores a custom id that is not the component system's", async () => {
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({ customId: "panel:settings:v:root" }))).toBe(false);
    expect(component.handled).toHaveLength(0);
  });

  test("ignores an unregistered component id", async () => {
    const component = new RecordingComponent();
    const interaction = stubInteraction({ customId: componentCustomId("other", "row-1") });
    expect(await route(component, interaction)).toBe(false);
    expect(component.handled).toHaveLength(0);
  });

  test("ignores a press from a user the row does not name", async () => {
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({ user: { id: "8" } }))).toBe(false);
    expect(component.handled).toHaveLength(0);
  });

  test("accepts any presser when the row names none", async () => {
    stored = storedRow({ userId: null });
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({ user: { id: "8" } }))).toBe(true);
    expect(component.handled).toHaveLength(1);
  });

  test("ignores a press whose interaction kind the row was not created for", async () => {
    stored = storedRow({ type: "string-select" });
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({}))).toBe(false);
    expect(component.handled).toHaveLength(0);
  });

  test("ignores a press from another guild", async () => {
    stored = storedRow({ guildId: "other" });
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({}))).toBe(false);
    expect(component.handled).toHaveLength(0);
  });

  test("accepts a DM press, where the row and the interaction are both guildless", async () => {
    stored = storedRow({ guildId: null });
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({ guildId: null }))).toBe(true);
    expect(component.handled).toHaveLength(1);
  });

  test("ignores an unknown or expired row", async () => {
    stored = null;
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({}))).toBe(false);
    expect(component.handled).toHaveLength(0);
  });

  test("hands the row and its payload to the component", async () => {
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({}))).toBe(true);
    expect(component.handled[0]?.payload).toEqual({ note: "hello" });
    expect(component.handled[0]?.row.messageId).toBe("m");
  });

  test("claims a one-shot row so a second press cannot run it again", async () => {
    const component = new RecordingComponent();
    expect(await route(component, stubInteraction({}))).toBe(true);
    expect(await route(component, stubInteraction({}))).toBe(false);
    expect(component.handled).toHaveLength(1);
  });

  test("leaves a reusable row in place across presses", async () => {
    const component = new ReusableComponent();
    expect(await route(component, stubInteraction({}))).toBe(true);
    expect(await route(component, stubInteraction({}))).toBe(true);
    expect(component.handled).toHaveLength(2);
  });

  test("swallows a handler failure and reports the press as owned", async () => {
    const component = new RecordingComponent();
    component.handle = async () => {
      throw new Error("boom");
    };
    expect(await route(component, stubInteraction({}))).toBe(true);
  });
});
