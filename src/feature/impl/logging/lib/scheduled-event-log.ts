import { yesNo } from "@/lib/format";
import {
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  type GuildScheduledEvent,
  type PartialGuildScheduledEvent,
} from "discord.js";
import { boldNameOrId, changeLine, channelMention, code, detailLine, enumLabel, timestamp } from "./text";

/**
 * A scheduled event as Discord sends it: fully cached for create, but a
 * partial (with a nullable name and enums) for delete and interest changes.
 */
export type ScheduledEvent = GuildScheduledEvent | PartialGuildScheduledEvent;

const ENTITY_NAMES: Record<number, string> = {
  [GuildScheduledEventEntityType.StageInstance]: "Stage",
  [GuildScheduledEventEntityType.Voice]: "Voice",
  [GuildScheduledEventEntityType.External]: "External",
};

const STATUS_NAMES: Record<number, string> = {
  [GuildScheduledEventStatus.Scheduled]: "Scheduled",
  [GuildScheduledEventStatus.Active]: "Active",
  [GuildScheduledEventStatus.Completed]: "Completed",
  [GuildScheduledEventStatus.Canceled]: "Canceled",
};

const PRIVACY_NAMES: Record<number, string> = {
  [GuildScheduledEventPrivacyLevel.GuildOnly]: "Guild Only",
};

export function scheduledEventName(scheduledEvent: ScheduledEvent): string {
  return boldNameOrId(scheduledEvent.name, scheduledEvent.id);
}

/** Where an event happens: a channel for stage/voice, the raw value for external. */
function location(scheduledEvent: ScheduledEvent): string {
  if (scheduledEvent.channelId) {
    return channelMention(scheduledEvent.channelId);
  }
  return scheduledEvent.entityMetadata?.location ? code(scheduledEvent.entityMetadata.location) : "None";
}

export function scheduledEventDetailLines(scheduledEvent: ScheduledEvent): string[] {
  const lines = [
    detailLine("Type", code(nullableEnumLabel(ENTITY_NAMES, scheduledEvent.entityType))),
    detailLine("Location", location(scheduledEvent)),
    detailLine("Starts", timestamp(scheduledEvent.scheduledStartTimestamp)),
  ];
  if (scheduledEvent.scheduledEndTimestamp) {
    lines.push(detailLine("Ends", timestamp(scheduledEvent.scheduledEndTimestamp)));
  }
  if (scheduledEvent.description) {
    lines.push(detailLine("Description", scheduledEvent.description));
  }
  if (scheduledEvent.userCount !== null && scheduledEvent.userCount !== undefined) {
    lines.push(detailLine("Interested", String(scheduledEvent.userCount)));
  }
  return lines;
}

/**
 * The event fields that changed, as ready-to-print lines. `userCount` moves
 * on every interest change and `GuildScheduledEventUpdate` fires for those
 * too, so it is not diffed here; the dedicated interest events cover it.
 */
export function describeScheduledEventChanges(
  oldEvent: ScheduledEvent | null,
  newEvent: ScheduledEvent
): string[] {
  if (!oldEvent) {
    return [];
  }
  const lines: string[] = [];
  if (oldEvent.name !== newEvent.name) {
    lines.push(changeLine("Name", code(oldEvent.name ?? "Unknown"), code(newEvent.name ?? "Unknown")));
  }
  if (oldEvent.description !== newEvent.description) {
    lines.push(changeLine("Description", oldEvent.description ?? "None", newEvent.description ?? "None"));
  }
  if (oldEvent.scheduledStartTimestamp !== newEvent.scheduledStartTimestamp) {
    lines.push(
      changeLine(
        "Starts",
        timestamp(oldEvent.scheduledStartTimestamp),
        timestamp(newEvent.scheduledStartTimestamp)
      )
    );
  }
  if (oldEvent.scheduledEndTimestamp !== newEvent.scheduledEndTimestamp) {
    lines.push(
      changeLine("Ends", timestamp(oldEvent.scheduledEndTimestamp), timestamp(newEvent.scheduledEndTimestamp))
    );
  }
  if (location(oldEvent) !== location(newEvent)) {
    lines.push(changeLine("Location", location(oldEvent), location(newEvent)));
  }
  if (oldEvent.privacyLevel !== newEvent.privacyLevel) {
    lines.push(
      changeLine(
        "Privacy",
        nullableEnumLabel(PRIVACY_NAMES, oldEvent.privacyLevel),
        nullableEnumLabel(PRIVACY_NAMES, newEvent.privacyLevel)
      )
    );
  }
  if (oldEvent.status !== newEvent.status) {
    lines.push(
      changeLine(
        "Status",
        nullableEnumLabel(STATUS_NAMES, oldEvent.status),
        nullableEnumLabel(STATUS_NAMES, newEvent.status)
      )
    );
  }
  if (oldEvent.image !== newEvent.image) {
    lines.push(changeLine("Cover Image", yesNo(Boolean(oldEvent.image)), yesNo(Boolean(newEvent.image))));
  }
  return lines;
}

/**
 * An enum from Discord's partial payload as its name, or "Unknown" when the
 * payload omitted it.
 */
function nullableEnumLabel(names: Record<number, string>, value: number | null | undefined): string {
  return value ? enumLabel(names, value) : "Unknown";
}
