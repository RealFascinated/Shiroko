import { EventHandler } from "@/event/event-handler";
import BotReadyEvent from "@/event/events/bot-ready.event";
import GuildJoinedEvent from "@/event/events/guild-joined.event";
import InviteCreatedEvent from "@/event/events/invite-created.event";
import InviteDeletedEvent from "@/event/events/invite-deleted.event";
import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import MemberGuildLeaveEvent from "@/event/events/member-guild-leave.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import type { Client } from "discord.js";
import InvitesCommand from "./command/invites/invites.command";
import { invitesService } from "./invites.service";

/**
 * The invites feature: `/invites` command plus invite tracking. Keeps the
 * invite snapshot seeded and maintains it on create/delete, and records each
 * join against the source the bridge resolved onto `MemberGuildJoinEvent`.
 */
export default class InvitesFeature extends Feature {
  constructor() {
    super(FeatureIds.Invites, { name: "Invites", emoji: "📨" });

    this.registerCommand(new InvitesCommand());
  }

  /**
   * Seed every guild's baseline on startup so joins diff against a fresh
   * snapshot.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    await this.seedAllGuilds(event.client);
  }

  @EventHandler(GuildJoinedEvent)
  public async onGuildJoined(event: GuildJoinedEvent): Promise<void> {
    await invitesService.refreshGuild(event.guildData);
  }

  @EventHandler(InviteCreatedEvent)
  public async onInviteCreated(event: InviteCreatedEvent): Promise<void> {
    await invitesService.handleInviteCreate(event.invite);
  }

  @EventHandler(InviteDeletedEvent)
  public async onInviteDeleted(event: InviteDeletedEvent): Promise<void> {
    await invitesService.handleInviteDelete(event.invite);
  }

  @EventHandler(MemberGuildJoinEvent)
  public async onMemberGuildJoin(event: MemberGuildJoinEvent): Promise<void> {
    const { member, source } = event;
    await invitesService.recordJoin(member.guild.id, member.id, source);
  }

  @EventHandler(MemberGuildLeaveEvent)
  public async onMemberGuildLeave(event: MemberGuildLeaveEvent): Promise<void> {
    const { member } = event;
    await invitesService.recordLeave(member.guild.id, member.id);
  }

  /**
   * Seed every guild the client is in so joins can be diffed against a
   * fresh baseline immediately after startup.
   */
  private async seedAllGuilds(client: Client): Promise<void> {
    for (const guild of client.guilds.cache.values()) {
      await invitesService.refreshGuild(guild);
    }
  }
}
