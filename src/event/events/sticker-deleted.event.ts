import type { Sticker } from "discord.js";
import Event from "../event";

/**
 * A sticker was deleted from a guild. Carries the deleted `Sticker` and
 * its guild.
 */
export default class StickerDeletedEvent extends Event {
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
