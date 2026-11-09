import type { AnyThreadChannel } from "discord.js";
import type { Fields } from "../drafts";

export function threadFields(thread: AnyThreadChannel): Fields {
  return {
    name: thread.name,
    parentId: thread.parentId,
    archived: thread.archived,
    locked: thread.locked,
    slowmode: thread.rateLimitPerUser,
    autoArchiveMinutes: thread.autoArchiveDuration,
  };
}
