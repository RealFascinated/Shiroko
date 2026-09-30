import type GlobalUser from "@/user/global-user";
import { describe, expect, test } from "bun:test";
import { EmbedBuilder, type Guild } from "discord.js";
import Panel, { type PanelContext, type PanelView } from "./panel";
import { displayValue, renderPanel, renderPanelEmbeds } from "./render";

/** A two-view panel over a nested config, exercising every control kind. */
interface DemoConfig {
  first: { name: string; count: string; on: boolean; channel: string | null };
  second: { name: string };
}

class DemoPanel extends Panel<DemoConfig> {
  public readonly segment = "demo";
  public readonly title = "Demo";

  public async getConfig(): Promise<DemoConfig> {
    return { first: { name: "Alpha", count: "3", on: true, channel: "9" }, second: { name: "Beta" } };
  }

  public async updateConfig(): Promise<void> {}

  public views(): readonly PanelView<DemoConfig>[] {
    return [
      {
        id: "first",
        label: "First",
        segment: "first",
        controls: () => [
          { kind: "dialog", key: "first.name", input: "text", label: "Name" },
          { kind: "toggle", key: "first.on", label: "Enabled", state: v => (v ? "On" : "Off") },
          {
            kind: "choice",
            key: "first.count",
            label: "Count",
            options: () => [
              { value: "3", label: "Three" },
              { value: "4", label: "Four" },
            ],
          },
        ],
        sections: () => [
          {
            id: "preview",
            kind: "text" as const,
            render: (config, ctx) => Promise.resolve(`preview of ${ctx.user.id} ${config.first.name}`),
          },
        ],
      },
      { id: "second", label: "Second", segment: "second", controls: () => [] },
    ];
  }
}

const guild = { id: "1", channels: { cache: { has: () => true } } } as unknown as Guild;
const user = { id: "7", firstSeen: new Date(0), discordUser: {} } as unknown as GlobalUser;
const context: PanelContext = { guild, user };

/** A panel whose only view is a single-mode message, for the mode test. */
class ModePanel extends Panel<{ mode: "embed" | "simple" }> {
  public readonly segment = "mode";
  public readonly title = "Mode";
  public async getConfig(): Promise<{ mode: "embed" | "simple" }> {
    return { mode: this.simple ? "simple" : "embed" };
  }
  public async updateConfig(): Promise<void> {}
  public constructor(private readonly simple: boolean) {
    super();
  }
  public views(): readonly PanelView<{ mode: "embed" | "simple" }>[] {
    return [
      {
        id: "m",
        label: "M",
        segment: "m",
        controls: config =>
          config.mode === "simple"
            ? [{ kind: "dialog", key: "simple", input: "paragraph", label: "Description" }]
            : [{ kind: "dialog", key: "title", input: "text", label: "Title" }],
      },
    ];
  }
}

/** A panel whose single view previews with a real embed. */
class EmbedPanel extends Panel<{ title: string }> {
  public readonly segment = "embed-demo";
  public readonly title = "Embed";
  public async getConfig(): Promise<{ title: string }> {
    return { title: "Preview title" };
  }
  public async updateConfig(): Promise<void> {}
  public views(): readonly PanelView<{ title: string }>[] {
    return [
      {
        id: "m",
        label: "M",
        segment: "m",
        controls: () => [],
        sections: () => [
          {
            id: "preview",
            kind: "embed" as const,
            render: async config => new EmbedBuilder().setTitle(config.title),
          },
        ],
      },
    ];
  }
}

describe("displayValue", () => {
  test("formats a dialog's raw string", async () => {
    const control = { kind: "dialog" as const, key: "first.name", input: "text" as const, label: "Name" };
    expect(displayValue(control, await new DemoPanel().getConfig(), context)).toBe("Alpha");
  });

  test("uses a dialog's formatter when present", async () => {
    const control = {
      kind: "dialog" as const,
      key: "first.channel",
      input: "channel" as const,
      label: "Channel",
      format: (value: unknown) => (typeof value === "string" ? `<#${value}>` : "*(none)*"),
    };
    expect(displayValue(control, await new DemoPanel().getConfig(), context)).toBe("<#9>");
  });

  test("renders a toggle through its state function", async () => {
    const control = {
      kind: "toggle" as const,
      key: "first.on",
      label: "Enabled",
      state: (v: boolean) => (v ? "On" : "Off"),
    };
    expect(displayValue(control, await new DemoPanel().getConfig(), context)).toBe("On");
  });

  test("renders a choice through its matching option", async () => {
    const control = {
      kind: "choice" as const,
      key: "first.count",
      label: "Count",
      options: () => [
        { value: "3", label: "Three" },
        { value: "4", label: "Four" },
      ],
    };
    expect(displayValue(control, await new DemoPanel().getConfig(), context)).toBe("Three");
  });

  test("reports an unset value as none", () => {
    const control = { kind: "dialog" as const, key: "missing", input: "text" as const, label: "Missing" };
    expect(displayValue(control, {} as DemoConfig, context)).toBe("*(none)*");
  });
});

describe("renderPanel", () => {
  test("renders one container per view section, plus the settings block", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    expect(rendered.flags).toBe(1 << 15);
    expect(rendered.components).toHaveLength(2);
  });

  test("keeps embed sections off the panel message", async () => {
    const rendered = await renderPanel(new EmbedPanel(), context, "m");
    // Just the settings block: the embed section must not become a container.
    expect(rendered.components).toHaveLength(1);
  });

  test("returns embed sections as embeds for a companion message", async () => {
    const embeds = await renderPanelEmbeds(new EmbedPanel(), context, "m");
    expect(embeds).toHaveLength(1);
    expect(embeds[0]!.toJSON().title).toBe("Preview title");
  });

  test("returns no embeds for a panel without embed sections", async () => {
    expect(await renderPanelEmbeds(new DemoPanel(), context, "first")).toEqual([]);
  });

  test("includes the heading, fields, and control labels", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("## Demo");
    expect(json).toContain("Name:** Alpha");
    expect(json).toContain("Enabled: On");
    expect(json).toContain("Count:** Three");
    expect(json).toContain("panel:demo:first:dialog:first.name");
    expect(json).toContain("panel:demo:first:toggle:first.on");
    expect(json).toContain("panel:demo:first:choice:first.count");
  });

  test("renders the view switcher when there is more than one view", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("panel:demo:first");
    expect(json).toContain("Second");
  });

  test("passes the acting user into section rendering", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "first");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("preview of 7 Alpha");
  });

  test("falls back to the first view for an unknown segment", async () => {
    const rendered = await renderPanel(new DemoPanel(), context, "gone");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).toContain("Name:** Alpha");
  });

  test("renders only the controls the current state offers", async () => {
    const simple = await renderPanel(new ModePanel(true), context, "m");
    const embed = await renderPanel(new ModePanel(false), context, "m");
    expect(JSON.stringify(simple.components.map(c => c.toJSON()))).toContain("panel:mode:m:dialog:simple");
    expect(JSON.stringify(embed.components.map(c => c.toJSON()))).toContain("panel:mode:m:dialog:title");
  });

  test("has no view switcher for a single-view panel", async () => {
    const rendered = await renderPanel(new ModePanel(false), context, "m");
    const json = JSON.stringify(rendered.components.map(component => component.toJSON()));
    expect(json).not.toContain('"custom_id":"panel:mode:m"');
  });
});
