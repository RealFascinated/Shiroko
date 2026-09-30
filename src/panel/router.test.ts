import GlobalUsersManager from "@/user/global-users-manager";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Guild, Interaction } from "discord.js";
import Panel, { panelCustomId, type PanelView } from "./panel";
import { setPath } from "./path";
import { handlePanelInteraction } from "./router";

interface DemoConfig {
  nested: { on: boolean; mode: string; text: string };
}

/**
 * A panel recording every write, with the control kinds the router acts
 * on. The config is a plain object, so a write can be asserted directly.
 */
class RecordingPanel extends Panel<DemoConfig> {
  public readonly segment = "rec";
  public readonly title = "Rec";
  public config: DemoConfig = { nested: { on: false, mode: "embed", text: "original" } };
  /** Every `[key, value]` the engine asked to persist. */
  public readonly writes: Array<[string, unknown]> = [];
  private rejectText = false;

  public rejectNextText(): void {
    this.rejectText = true;
  }

  public async getConfig(): Promise<DemoConfig> {
    return this.config;
  }

  public async updateConfig(
    _guild: Guild,
    _view: PanelView<DemoConfig>,
    key: string,
    value: unknown
  ): Promise<void> {
    this.writes.push([key, value]);
    this.config = setPath(this.config, key, value);
  }

  public async setConfigForTest(config: DemoConfig): Promise<void> {
    this.config = config;
  }

  public views(): readonly PanelView<DemoConfig>[] {
    return [
      {
        id: "only",
        label: "Only",
        segment: "v",
        controls: () => [
          { kind: "toggle", key: "nested.on", label: "On", state: v => (v ? "On" : "Off") },
          {
            kind: "choice",
            key: "nested.mode",
            label: "Mode",
            options: () => [
              { value: "embed", label: "Embed" },
              { value: "simple", label: "Simple" },
            ],
          },
          {
            kind: "dialog",
            key: "nested.text",
            input: "text",
            label: "Text",
            validate: input => (this.rejectText && input === "bad" ? "Nope." : null),
          },
        ],
      },
    ];
  }
}

const guild = { id: "1", channels: { cache: { has: () => false } } } as unknown as Guild;

/** A panel whose one dialog transforms its text into a stored number. */
class TransformPanel extends Panel<{ colour: number }> {
  public readonly segment = "tf";
  public readonly title = "TF";
  public stored = 0;

  public async getConfig(): Promise<{ colour: number }> {
    return { colour: this.stored };
  }

  public async updateConfig(
    _guild: Guild,
    _view: PanelView<{ colour: number }>,
    _key: string,
    value: unknown
  ): Promise<void> {
    this.stored = value as number;
  }

  public views(): readonly PanelView<{ colour: number }>[] {
    return [
      {
        id: "v",
        label: "V",
        segment: "v",
        controls: () => [
          {
            kind: "dialog",
            key: "colour",
            input: "text",
            label: "Colour",
            transform: input => Number.parseInt(input.replace("#", ""), 16),
          },
        ],
      },
    ];
  }
}

/** An interaction stub exposing only what the router reads. */
function stubInteraction(overrides: Record<string, unknown>): Interaction {
  return {
    inGuild: () => true,
    guild,
    user: { id: "7" },
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    update: () => {},
    reply: () => {},
    ...overrides,
  } as unknown as Interaction;
}

function button(panel: RecordingPanel, path: string): Interaction {
  return stubInteraction({
    customId: panelCustomId(panel.segment, "v", "toggle", path),
    isButton: () => true,
  });
}

async function route(panel: RecordingPanel, interaction: Interaction): Promise<boolean> {
  return handlePanelInteraction(interaction, segment =>
    segment === panel.segment ? (panel as never) : undefined
  );
}

/** The router resolves the acting user; stub it so no database is touched. */
const realGetUser = GlobalUsersManager.getUser;
let resolvedUsers: string[] = [];

beforeEach(() => {
  resolvedUsers = [];
  GlobalUsersManager.getUser = (async (user: { id: string }) => {
    resolvedUsers.push(user.id);
    return { id: user.id, firstSeen: new Date(0), discordUser: user };
  }) as unknown as typeof GlobalUsersManager.getUser;
});

afterEach(() => {
  GlobalUsersManager.getUser = realGetUser;
});

describe("panel router dispatch", () => {
  test("ignores interactions outside a guild", async () => {
    const panel = new RecordingPanel();
    expect(await route(panel, stubInteraction({ inGuild: () => false }))).toBe(false);
  });

  test("ignores a component of an unregistered panel", async () => {
    const panel = new RecordingPanel();
    const interaction = stubInteraction({ customId: "panel:other:v", isButton: () => true });
    expect(await route(panel, interaction)).toBe(false);
  });

  test("ignores an id from another subsystem", async () => {
    const panel = new RecordingPanel();
    const interaction = stubInteraction({ customId: "settings:1:0:key:edit", isButton: () => true });
    expect(await route(panel, interaction)).toBe(false);
  });

  test("a toggle press flips the boolean at its path", async () => {
    const panel = new RecordingPanel();
    expect(await route(panel, button(panel, "nested.on"))).toBe(true);
    expect(panel.config.nested.on).toBe(true);
  });

  test("writes exactly one setting per press, not the whole config", async () => {
    const panel = new RecordingPanel();
    await route(panel, button(panel, "nested.on"));
    expect(panel.writes).toHaveLength(1);
    expect(panel.writes[0]).toEqual(["nested.on", true]);
  });

  test("passes the view the press was rendered under", async () => {
    const panel = new RecordingPanel();
    let seen = "";
    const original = panel.updateConfig.bind(panel);
    panel.updateConfig = async (guild, view, key, value) => {
      seen = view.segment;
      await original(guild, view, key, value);
    };
    await route(panel, button(panel, "nested.on"));
    expect(seen).toBe("v");
  });

  test("a toggle writes immutably, leaving the previous config untouched", async () => {
    const panel = new RecordingPanel();
    const before = panel.config;
    await route(panel, button(panel, "nested.on"));
    expect(before.nested.on).toBe(false);
    expect(panel.config).not.toBe(before);
  });

  test("a choice select writes the selected value", async () => {
    const panel = new RecordingPanel();
    const interaction = stubInteraction({
      customId: panelCustomId(panel.segment, "v", "choice", "nested.mode"),
      isStringSelectMenu: () => true,
      values: ["simple"],
    });
    expect(await route(panel, interaction)).toBe(true);
    expect(panel.config.nested.mode).toBe("simple");
  });

  test("a dialog writes its submitted text", async () => {
    const panel = new RecordingPanel();
    const interaction = stubInteraction({
      customId: panelCustomId(panel.segment, "v", "dialog", "nested.text"),
      isModalSubmit: () => true,
      deferred: false,
      replied: false,
      fields: { fields: new Map([["value", { value: "written" }]]) },
      message: null,
    });
    expect(await route(panel, interaction)).toBe(true);
    expect(panel.config.nested.text).toBe("written");
  });

  test("a dialog transforms its input before storing", async () => {
    const panel = new TransformPanel();
    const interaction = stubInteraction({
      customId: panelCustomId(panel.segment, "v", "dialog", "colour"),
      isModalSubmit: () => true,
      deferred: false,
      replied: false,
      fields: { fields: new Map([["value", { value: "#9b59b6" }]]) },
      message: null,
    });
    await handlePanelInteraction(interaction, segment =>
      segment === panel.segment ? (panel as never) : undefined
    );
    expect(panel.stored).toBe(0x9b59b6);
  });

  test("a rejected dialog leaves the config untouched and replies", async () => {
    const panel = new RecordingPanel();
    panel.rejectNextText();
    let replied: unknown = null;
    const interaction = stubInteraction({
      customId: panelCustomId(panel.segment, "v", "dialog", "nested.text"),
      isModalSubmit: () => true,
      deferred: false,
      replied: false,
      fields: { fields: new Map([["value", { value: "bad" }]]) },
      message: null,
      reply: (payload: unknown) => {
        replied = payload;
      },
    });
    await route(panel, interaction);
    expect(panel.config.nested.text).toBe("original");
    expect(replied).not.toBeNull();
  });

  test("ignores a control the view no longer offers", async () => {
    const panel = new RecordingPanel();
    const interaction = stubInteraction({
      customId: panelCustomId(panel.segment, "v", "toggle", "nested.gone"),
      isButton: () => true,
    });
    await route(panel, interaction);
    expect(panel.config.nested).toEqual({ on: false, mode: "embed", text: "original" });
  });

  test("resolves the acting user once per press", async () => {
    const panel = new RecordingPanel();
    await route(panel, button(panel, "nested.on"));
    expect(resolvedUsers).toEqual(["7"]);
  });
});
