import { AuditLogEvent } from "discord.js";
import MemberBannedEvent from "../../event/events/member-banned.event";
import MemberBoostUpdatedEvent from "../../event/events/member-boost-updated.event";
import MemberGuildJoinEvent from "../../event/events/member-guild-join.event";
import MemberGuildLeaveEvent from "../../event/events/member-guild-leave.event";
import MemberNicknameUpdatedEvent from "../../event/events/member-nickname-updated.event";
import MemberRolesUpdatedEvent from "../../event/events/member-roles-updated.event";
import MemberTimeoutUpdatedEvent from "../../event/events/member-timeout-updated.event";
import MemberUnbannedEvent from "../../event/events/member-unbanned.event";
import { show } from "../fields";
import { formatValue, GuildHistoryKind, type GuildHistoryDraft, type HistoryEntry } from "../history-kind";

export class MemberJoinKind extends GuildHistoryKind<MemberGuildJoinEvent> {
  public readonly id: string = "member_join";
  public readonly label: string = "Joined";
  public readonly eventClass: new (...args: any[]) => MemberGuildJoinEvent = MemberGuildJoinEvent;

  public draft({ member, source }: MemberGuildJoinEvent): GuildHistoryDraft {
    return { guild: member.guild, subjectId: member.id, oldValue: null, newValue: source };
  }

  protected override details(row: HistoryEntry): string[] {
    return [`**Via**: ${formatValue(row.newValue)}`];
  }
}

/**
 * The old value is the roles held at the moment of leaving, which is what a
 * sticky-role restore reads back; `null` when the member was not cached.
 */
export class MemberLeaveKind extends GuildHistoryKind<MemberGuildLeaveEvent> {
  public readonly id: string = "member_leave";
  public readonly label: string = "Left";
  public readonly eventClass: new (...args: any[]) => MemberGuildLeaveEvent = MemberGuildLeaveEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberKick];

  public draft({ member }: MemberGuildLeaveEvent): GuildHistoryDraft {
    return {
      guild: member.guild,
      subjectId: member.id,
      oldValue: member.partial ? null : { roleIds: [...member.roles.cache.keys()] },
      newValue: null,
    };
  }

  protected override title(row: HistoryEntry): string {
    return row.actorId ? "Kicked" : this.label;
  }

  protected override details(row: HistoryEntry): string[] {
    const { roleIds = [] } = (row.oldValue ?? {}) as { roleIds?: string[] };
    return roleIds.length > 0 ? [`**Roles**: ${roleIds.map(id => `<@&${id}>`).join(" ")}`] : [];
  }
}

export class MemberBanKind extends GuildHistoryKind<MemberBannedEvent> {
  public readonly id: string = "member_ban";
  public readonly label: string = "Banned";
  public readonly eventClass: new (...args: any[]) => MemberBannedEvent = MemberBannedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberBanAdd];

  public draft({ ban }: MemberBannedEvent): GuildHistoryDraft {
    return {
      guild: ban.guild,
      subjectId: ban.user.id,
      oldValue: null,
      newValue: { reason: ban.reason ?? null },
    };
  }
}

export class MemberUnbanKind extends GuildHistoryKind<MemberUnbannedEvent> {
  public readonly id: string = "member_unban";
  public readonly label: string = "Unbanned";
  public readonly eventClass: new (...args: any[]) => MemberUnbannedEvent = MemberUnbannedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberBanRemove];

  public draft({ ban }: MemberUnbannedEvent): GuildHistoryDraft {
    return {
      guild: ban.guild,
      subjectId: ban.user.id,
      oldValue: { reason: ban.reason ?? null },
      newValue: null,
    };
  }
}

export class NicknameKind extends GuildHistoryKind<MemberNicknameUpdatedEvent> {
  public readonly id: string = "nickname";
  public readonly label: string = "Nickname";
  public readonly eventClass: new (...args: any[]) => MemberNicknameUpdatedEvent = MemberNicknameUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberUpdate];

  public draft({ oldMember, newMember }: MemberNicknameUpdatedEvent): GuildHistoryDraft {
    return {
      guild: newMember.guild,
      subjectId: newMember.id,
      oldValue: oldMember.nickname,
      newValue: newMember.nickname,
    };
  }

  protected override details(row: HistoryEntry): string[] {
    return [`${show(row.oldValue)} → ${show(row.newValue)}`];
  }
}

/** Old/new hold the role ids that were added and removed; the roles a member ended up with are the replay of these. */
export class RolesKind extends GuildHistoryKind<MemberRolesUpdatedEvent> {
  public readonly id: string = "roles";
  public readonly label: string = "Roles";
  public readonly eventClass: new (...args: any[]) => MemberRolesUpdatedEvent = MemberRolesUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberRoleUpdate];

  public draft({ newMember, added, removed }: MemberRolesUpdatedEvent): GuildHistoryDraft {
    return {
      guild: newMember.guild,
      subjectId: newMember.id,
      oldValue: null,
      newValue: { added: [...added.keys()], removed: [...removed.keys()] },
    };
  }

  protected override details(row: HistoryEntry): string[] {
    const { added = [], removed = [] } = (row.newValue ?? {}) as { added?: string[]; removed?: string[] };
    const roles = (ids: string[]): string => ids.map(id => `<@&${id}>`).join(" ");
    return [
      ...(added.length > 0 ? [`**Added**: ${roles(added)}`] : []),
      ...(removed.length > 0 ? [`**Removed**: ${roles(removed)}`] : []),
    ];
  }
}

export class TimeoutKind extends GuildHistoryKind<MemberTimeoutUpdatedEvent> {
  public readonly id: string = "timeout";
  public readonly label: string = "Timeout";
  public readonly eventClass: new (...args: any[]) => MemberTimeoutUpdatedEvent = MemberTimeoutUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberUpdate];

  public draft({ oldMember, newMember, timeoutUntil }: MemberTimeoutUpdatedEvent): GuildHistoryDraft {
    return {
      guild: newMember.guild,
      subjectId: newMember.id,
      oldValue: oldMember.communicationDisabledUntil?.toISOString() ?? null,
      newValue: timeoutUntil?.toISOString() ?? null,
    };
  }

  protected override details(row: HistoryEntry): string[] {
    return [
      typeof row.newValue === "string"
        ? `Timed out until <t:${Math.floor(new Date(row.newValue).getTime() / 1000)}:f>`
        : "Timeout removed",
    ];
  }
}

export class BoostKind extends GuildHistoryKind<MemberBoostUpdatedEvent> {
  public readonly id: string = "boost";
  public readonly label: string = "Boost";
  public readonly eventClass: new (...args: any[]) => MemberBoostUpdatedEvent = MemberBoostUpdatedEvent;

  public draft({ newMember, boosted }: MemberBoostUpdatedEvent): GuildHistoryDraft {
    return { guild: newMember.guild, subjectId: newMember.id, oldValue: !boosted, newValue: boosted };
  }

  protected override details(row: HistoryEntry): string[] {
    return [row.newValue ? "Started boosting" : "Stopped boosting"];
  }
}
