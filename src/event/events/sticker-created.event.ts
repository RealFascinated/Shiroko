import type { Sticker } from "discord.js";
import Event from "../event";

/**
 * A sticker was created in a guild. Carries the new `Sticker` and its
 * guild (resolved from the sticker's `guildId`).
 */
export default class StickerCreatedEvent extends Event {
  public readonly stickerId: string;
  public readonly sticker: Sticker;
  public readonly guildData: Sticker["guild"];

  constructor(sticker: Sticker) {
    super({ guild: sticker.guild });
    this.stickerId = sticker.id;
    this.sticker = sticker;
    this.guildData = sticker.guild;
  }
}
