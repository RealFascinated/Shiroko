import type { Client } from "discord.js";
import { EventBus } from "../../event/event-bus";
import { EventHandler } from "../../event/event-handler";
import { EventListener } from "../../event/event-listener";
import BotReadyEvent from "../../event/events/bot-ready.event";
import GuildJoinedEvent from "../../event/events/guild-joined.event";
import InviteCreatedEvent from "../../event/events/invite-created.event";
import InviteDeletedEvent from "../../event/events/invite-deleted.event";
import MemberGuildJoinEvent from "../../event/events/member-guild-join.event";
import { FeatureIds } from "../feature-ids";
import Feature from "../feature.ts";
import InvitesCommand from "./command/invites/invites.command";
import { invitesService } from "./invites.service";

/**
 * The invites feature: `/invites` command plus invite tracking.
 */
export default class InvitesFeature extends Feature {
  constructor() {
    super(FeatureIds.Invites);

    this.registerCommand(new InvitesCommand());
  }
}

/**
 * Keeps the invite snapshot seeded and maintains it on create/delete, and
 * attributes `GuildMemberAdd` joins by diffing the cached baseline against
 * a fresh fetch.
 */
export class InvitesListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  /**
   * Seed every guild's baseline on startup so joins diff against a fresh
   * snapshot.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    await this.seedAllGuilds(event.client);
  }

  /**
   * Seed a new guild's baseline when the bot joins it.
   */
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

  /**
   * Attribute a join by diffing the current baseline against a fresh
   * invite fetch, then record it (even when unknown).
   */
  @EventHandler(MemberGuildJoinEvent)
  public async onMemberGuildJoin(event: MemberGuildJoinEvent): Promise<void> {
    const guild = event.member.guild;
    const baseline = invitesService.snapshot(guild.id);
    const attribution = await invitesService.diffJoin(guild, baseline);
    await invitesService.recordJoin(guild.id, event.member.id, attribution);
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
