import { describe, expect, test } from "bun:test";
import type { Sticker } from "discord.js";
import { describeStickerChanges } from "./sticker-log";

const sticker = (fields: { description?: string; tags?: string }): Sticker =>
  ({ name: "a", description: null, tags: null, ...fields }) as unknown as Sticker;

describe("describeStickerChanges", () => {
  test("treats an empty description or tags as unset", () => {
    expect(describeStickerChanges(sticker({}), sticker({ description: "", tags: "" }))).toEqual([]);
  });

  test("reports a real description change", () => {
    expect(describeStickerChanges(sticker({}), sticker({ description: "hi" }))).toHaveLength(1);
  });
});
