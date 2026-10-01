import { describe, expect, test } from "bun:test";
import { PANEL_PREFIX, panelCustomId, parsePanelCustomId } from "./panel";

describe("panel custom ids", () => {
  test("round-trips a dialog id", () => {
    expect(parsePanelCustomId(panelCustomId("welcomer", "welcome", "dialog", "welcome.embed.title"))).toEqual(
      {
        segment: "welcomer",
        viewSegment: "welcome",
        kind: "dialog",
        path: "welcome.embed.title",
      }
    );
  });

  test("decodes a view switcher", () => {
    expect(parsePanelCustomId(panelCustomId("w", "welcome", "root"))).toEqual({
      segment: "w",
      viewSegment: "welcome",
      kind: "root",
      path: null,
    });
  });

  test("rejects ids from other systems", () => {
    expect(parsePanelCustomId("settings:1:0:key:edit")).toBeNull();
    expect(parsePanelCustomId(PANEL_PREFIX)).toBeNull();
    expect(parsePanelCustomId("welcomer:1:welcome")).toBeNull();
  });

  test("rejects an unknown component kind", () => {
    expect(parsePanelCustomId("panel:w:v:banana:key")).toBeNull();
  });

  test("rejects trailing segments", () => {
    expect(parsePanelCustomId("panel:w:v:toggle:key:extra")).toBeNull();
  });
});
