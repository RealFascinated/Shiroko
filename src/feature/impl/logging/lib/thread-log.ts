import { yesNo } from "@/lib/format";
import { ChannelType, type AnyThreadChannel } from "discord.js";
import { changeLine, channelMention, code, detailLine, enumLabel, idLine, userMention } from "./text";

/** User-facing names for the thread channel types. */
const THREAD_TYPE_NAMES: Record<number, string> = {
  [ChannelType.PublicThread]: "Public",
  [ChannelType.PrivateThread]: "Private",
  [ChannelType.AnnouncementThread]: "Announcement",
};

/** A thread's auto-archive window as a readable duration. */
function formatArchiveDuration(minutes: number | null): string {
  if (!minutes) {
    return "None";
  }
  return minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`;
}

/** The details worth logging when a thread is created. */
export function threadDetailLines(thread: AnyThreadChannel): string[] {
  return [
    detailLine("Name", code(thread.name)),
    detailLine("Type", code(enumLabel(THREAD_TYPE_NAMES, thread.type))),
    detailLine("Parent", channelMention(thread.parentId)),
    detailLine("Owner", userMention(thread.ownerId)),
    idLine(thread.id),
  ];
}

/**
 * The thread fields that changed, as ready-to-print lines. Discord also
 * bumps a thread's message count and last-activity time on every post,
 * which would fire an update per message, so neither is diffed.
 */
export function describeThreadChanges(oldThread: AnyThreadChannel, newThread: AnyThreadChannel): string[] {
  const lines: string[] = [];
  if (oldThread.name !== newThread.name) {
    lines.push(changeLine("Name", code(oldThread.name), code(newThread.name)));
  }
  if (oldThread.archived !== newThread.archived) {
    lines.push(
      changeLine("Archived", yesNo(oldThread.archived ?? false), yesNo(newThread.archived ?? false))
    );
  }
  if (oldThread.locked !== newThread.locked) {
    lines.push(changeLine("Locked", yesNo(oldThread.locked ?? false), yesNo(newThread.locked ?? false)));
  }
  if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
    lines.push(
      changeLine("Slow Mode", `${oldThread.rateLimitPerUser ?? 0}s`, `${newThread.rateLimitPerUser ?? 0}s`)
    );
  }
  if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
    lines.push(
      changeLine(
        "Auto Archive",
        formatArchiveDuration(oldThread.autoArchiveDuration),
        formatArchiveDuration(newThread.autoArchiveDuration)
      )
    );
  }
  return lines;
}
