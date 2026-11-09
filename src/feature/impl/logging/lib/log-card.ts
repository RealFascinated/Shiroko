import { Constants } from "@/constants";
import { baseEmbed } from "@/lib/embed";
import type { EmbedBuilder, Guild, GuildMember, PartialGuildMember, PartialUser, User } from "discord.js";
import type { AuditActor } from "./audit-log";
import { detailLine } from "./text";
import { subjectAuthor, userLabel } from "./user-log";

/**
 * A log card's accent color, by what the event did to its subject, so a
 * moderator scanning the channel can tell additions from removals at a
 * glance.
 */
export const LogTone = {
  Positive: 0x57f287,
  Change: 0xfee75c,
  Negative: 0xed4245,
  Neutral: Constants.mainColor,
} as const;

export type LogTone = (typeof LogTone)[keyof typeof LogTone];

export type LogSubject = GuildMember | PartialGuildMember | User | PartialUser;

/**
 * Everything a log card shows. {@link buildLogCard} lays every card out the
 * same way: the author row, the headline, a blank line, the details, then
 * the moderator and reason.
 */
export interface LogCard {
  tone: LogTone;
  headline: string;
  details?: string[];
  actor?: AuditActor | null;
  // The author row; falls back to the actor, then the server.
  subject?: LogSubject | null;
  footer?: string;
  thumbnail?: string | null;
  image?: string | null;
}

export function idFooter(label: string, id: string): string {
  return `${label} ID: ${id}`;
}

export function buildLogCard(guild: Guild, card: LogCard): EmbedBuilder {
  const lines = [...(card.details ?? []), ...actorLines(card.actor ?? null, card.subject?.id ?? null)];
  const author = card.subject ?? card.actor?.executor;
  const embed = baseEmbed()
    .setColor(card.tone)
    .setAuthor(
      author
        ? subjectAuthor(author)
        : { name: guild.name, iconURL: guild.iconURL({ extension: "webp" }) ?? undefined }
    )
    .setDescription(lines.length > 0 ? [card.headline, "", ...lines].join("\n") : card.headline)
    .setThumbnail(card.thumbnail ?? null)
    .setImage(card.image ?? null)
    .setTimestamp(new Date());
  return card.footer ? embed.setFooter({ text: card.footer }) : embed;
}

/**
 * The moderator and reason behind an audit-logged change, or nothing when
 * the action left no entry, so a card never claims an actor it could not
 * resolve. A subject acting on themselves (picking onboarding roles, say)
 * reads as "Self" rather than repeating their own mention.
 */
function actorLines(actor: AuditActor | null, subjectId: string | null): string[] {
  if (!actor) {
    return [];
  }
  const self = actor.executor !== null && actor.executor.id === subjectId;
  const lines = [detailLine("Moderator", self ? "Self" : userLabel(actor.executor))];
  if (actor.reason) {
    lines.push(detailLine("Reason", actor.reason));
  }
  return lines;
}
