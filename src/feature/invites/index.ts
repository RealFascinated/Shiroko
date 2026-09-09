import { Events, type Client } from "discord.js";
import Feature, { FeatureIds } from "../feature";
import InvitesCommand from "./command/invites/invites.command";
import { invitesService } from "./invites.service";

/**
 * Tracks who invited whom via invite-code diffing.
 *
 * Responsibilities:
 * - Seed each guild's invite snapshot on `ClientReady` and `GuildCreate`.
 * - Maintain the snapshot on `InviteCreate` / `InviteDelete`.
 * - Attribute `GuildMemberAdd` joins by re-fetching invites and diffing
 *   `uses` against the cached baseline; joins with no delta (vanity URLs,
 *   OAuth widget, expired single-use codes, or a bot without `ManageGuild`)
 *   are recorded as unknown.
 *
 * When the bot lacks `ManageGuild`, `guild.invites.fetch()` throws, the
 * cache stays empty, and every join is recorded unknown — surfaced by the
 * `/invites` command as an error hint.
 */
export default class InvitesFeature extends Feature {
  constructor() {
    super(FeatureIds.Invites);

    this.registerCommand(new InvitesCommand());

    this.registerEventListener(Events.ClientReady, async readyClient => {
      await this.seedAllGuilds(readyClient);
    });

    this.registerEventListener(Events.GuildCreate, async guild => {
      await invitesService.refreshGuild(guild);
    });

    this.registerEventListener(Events.InviteCreate, async invite => {
      if (!invite.guild) {
        return;
      }
      await invitesService.handleInviteCreate(invite);
    });

    this.registerEventListener(Events.InviteDelete, async invite => {
      if (!invite.guild) {
        return;
      }
      await invitesService.handleInviteDelete(invite);
    });

    this.registerEventListener(Events.GuildMemberAdd, async member => {
      if (member.user.bot) {
        return;
      }
      const guild = member.guild;
      const baseline = invitesService.snapshot(guild.id);
      const attribution = await invitesService.diffJoin(guild, baseline);
      await invitesService.recordJoin(guild.id, member.id, attribution);
    });
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
