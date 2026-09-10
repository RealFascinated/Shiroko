import { Events, type Client } from "discord.js";
import EventBus from "./event-bus";
import BotReadyEvent from "./events/bot-ready.event";
import ContextMenuReceivedEvent from "./events/context-menu-received.event";
import GuildJoinedEvent from "./events/guild-joined.event";
import GuildLeftEvent from "./events/guild-left.event";
import InviteCreatedEvent from "./events/invite-created.event";
import InviteDeletedEvent from "./events/invite-deleted.event";
import MemberGuildJoinEvent from "./events/member-guild-join.event";
import MemberRolesUpdatedEvent from "./events/member-roles-updated.event";
import MessageCreatedEvent from "./events/message-created.event";
import RoleDeletedEvent from "./events/role-deleted.event";
import RoleUpdatedEvent from "./events/role-updated.event";
import SlashCommandReceivedEvent from "./events/slash-command-received.event";
import VoiceStateChangedEvent from "./events/voice-state-changed.event";

/**
 * The single adapter between the discord.js gateway and the internal event
 * bus. One listener per client event, converting raw payloads into wrapped
 * {@link Event} objects with guild/global-user context pre-resolved where
 * cheap. Listeners never touch `client.on` directly; they subscribe to the
 * bus.
 */
export default class EventBridge {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Attach the bridge's client listeners.
   */
  public registerHandlers(): void {
    const client = this.client;

    client.on(Events.MessageCreate, message => {
      if (message.author.bot || message.webhookId) {
        return;
      }
      if (!message.guildId) {
        return;
      }
      const guild = message.guild;
      if (!guild) {
        return;
      }
      void EventBus.post(new MessageCreatedEvent(message, guild));
    });

    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      if (newState.id === newState.client.user?.id) {
        return;
      }
      const user = newState.member?.user ?? oldState.member?.user;
      if (user?.bot) {
        return;
      }
      void EventBus.post(new VoiceStateChangedEvent(oldState, newState));
    });

    client.on(Events.ClientReady, readyClient => {
      void EventBus.post(new BotReadyEvent(readyClient));
    });

    client.on(Events.GuildCreate, guild => {
      void EventBus.post(new GuildJoinedEvent(guild));
    });

    client.on(Events.GuildDelete, guild => {
      void EventBus.post(new GuildLeftEvent(guild));
    });

    client.on(Events.InviteCreate, invite => {
      void EventBus.post(new InviteCreatedEvent(invite));
    });

    client.on(Events.InviteDelete, invite => {
      void EventBus.post(new InviteDeletedEvent(invite));
    });

    client.on(Events.GuildMemberAdd, member => {
      if (member.user.bot) {
        return;
      }
      void EventBus.post(new MemberGuildJoinEvent(member));
    });

    client.on(Events.GuildRoleUpdate, role => {
      void EventBus.post(new RoleUpdatedEvent(role.id, role.guild));
    });

    client.on(Events.GuildRoleDelete, role => {
      void EventBus.post(new RoleDeletedEvent(role.id, role.guild));
    });

    client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
      if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        void EventBus.post(new MemberRolesUpdatedEvent(oldMember, newMember));
      }
    });

    client.on(Events.InteractionCreate, interaction => {
      if (interaction.isChatInputCommand()) {
        void EventBus.post(new SlashCommandReceivedEvent(interaction));
      } else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
        void EventBus.post(new ContextMenuReceivedEvent(interaction));
      }
    });
  }
}
