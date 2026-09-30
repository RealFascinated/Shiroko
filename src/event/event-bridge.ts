import { Events, type Client, type DMChannel, type Guild, type NonThreadGuildBasedChannel } from "discord.js";
import { EventBus } from "./event-bus";
import BotReadyEvent from "./events/bot-ready.event";
import ChannelCreatedEvent from "./events/channel-created.event";
import ChannelDeletedEvent from "./events/channel-deleted.event";
import ChannelUpdatedEvent from "./events/channel-updated.event";
import ComponentReceivedEvent from "./events/component-received.event";
import ContextMenuReceivedEvent from "./events/context-menu-received.event";
import EmojiCreatedEvent from "./events/emoji-created.event";
import EmojiDeletedEvent from "./events/emoji-deleted.event";
import EmojiUpdatedEvent from "./events/emoji-updated.event";
import GuildJoinedEvent from "./events/guild-joined.event";
import GuildLeftEvent from "./events/guild-left.event";
import GuildUpdatedEvent from "./events/guild-updated.event";
import InviteCreatedEvent from "./events/invite-created.event";
import InviteDeletedEvent from "./events/invite-deleted.event";
import MemberBannedEvent from "./events/member-banned.event";
import MemberGuildJoinEvent from "./events/member-guild-join.event";
import MemberGuildLeaveEvent from "./events/member-guild-leave.event";
import MemberNicknameUpdatedEvent from "./events/member-nickname-updated.event";
import MemberRolesUpdatedEvent from "./events/member-roles-updated.event";
import MessageCreatedEvent from "./events/message-created.event";
import RoleCreatedEvent from "./events/role-created.event";
import RoleDeletedEvent from "./events/role-deleted.event";
import RoleUpdatedEvent from "./events/role-updated.event";
import SlashCommandReceivedEvent from "./events/slash-command-received.event";
import StickerCreatedEvent from "./events/sticker-created.event";
import StickerDeletedEvent from "./events/sticker-deleted.event";
import StickerUpdatedEvent from "./events/sticker-updated.event";
import UserAvatarUpdatedEvent from "./events/user-avatar-updated.event";
import UserDisplayNameUpdatedEvent from "./events/user-display-name-updated.event";
import UserPresenceChangedEvent from "./events/user-presence-changed.event";
import UserUsernameUpdatedEvent from "./events/user-username-updated.event";
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

    client.on(Events.GuildUpdate, (oldGuild, newGuild) => {
      void EventBus.post(new GuildUpdatedEvent(oldGuild, newGuild));
    });

    client.on(Events.ChannelCreate, channel => {
      if (channel.isThread()) {
        return;
      }
      void EventBus.post(new ChannelCreatedEvent(channel));
    });

    client.on(Events.ChannelUpdate, (oldChannel, newChannel) => {
      const oldGuildChannel = asGuildChannel(oldChannel);
      const newGuildChannel = asGuildChannel(newChannel);
      if (!oldGuildChannel || !newGuildChannel) {
        return;
      }
      if (oldGuildChannel.isThread() || newGuildChannel.isThread()) {
        return;
      }
      // A channel that wasn't cached arrives as a partial update with no
      // previous state, so there is nothing to diff.
      if (oldGuildChannel.partial || newGuildChannel.partial) {
        return;
      }
      void EventBus.post(new ChannelUpdatedEvent(oldGuildChannel, newGuildChannel));
    });

    client.on(Events.ChannelDelete, channel => {
      const guildChannel = asGuildChannel(channel);
      // A deletion for an uncached channel is partial, so name/type may be
      // missing entirely.
      if (!guildChannel || guildChannel.partial || guildChannel.isThread()) {
        return;
      }
      void EventBus.post(new ChannelDeletedEvent(guildChannel));
    });

    client.on(Events.InviteCreate, invite => {
      const guild = invite.guild ? (client.guilds.cache.get(invite.guild.id) ?? null) : null;
      void EventBus.post(new InviteCreatedEvent(invite, guild));
    });

    client.on(Events.InviteDelete, invite => {
      const guild = invite.guild ? (client.guilds.cache.get(invite.guild.id) ?? null) : null;
      void EventBus.post(new InviteDeletedEvent(invite, guild));
    });

    client.on(Events.GuildMemberAdd, member => {
      if (member.user.bot) {
        return;
      }
      void EventBus.post(new MemberGuildJoinEvent(member));
    });

    client.on(Events.GuildBanAdd, ban => {
      void EventBus.post(new MemberBannedEvent(ban, true));
    });

    client.on(Events.GuildBanRemove, ban => {
      void EventBus.post(new MemberBannedEvent(ban, false));
    });

    client.on(Events.GuildMemberRemove, member => {
      if (member.user.bot) {
        return;
      }
      void EventBus.post(new MemberGuildLeaveEvent(member));
    });

    client.on(Events.GuildEmojiCreate, emoji => {
      void EventBus.post(new EmojiCreatedEvent(emoji));
    });

    client.on(Events.GuildEmojiUpdate, (oldEmoji, newEmoji) => {
      void EventBus.post(new EmojiUpdatedEvent(oldEmoji, newEmoji));
    });

    client.on(Events.GuildEmojiDelete, emoji => {
      void EventBus.post(new EmojiDeletedEvent(emoji));
    });

    client.on(Events.GuildStickerCreate, sticker => {
      void EventBus.post(new StickerCreatedEvent(sticker));
    });

    client.on(Events.GuildStickerUpdate, (oldSticker, newSticker) => {
      void EventBus.post(new StickerUpdatedEvent(oldSticker, newSticker));
    });

    client.on(Events.GuildStickerDelete, sticker => {
      void EventBus.post(new StickerDeletedEvent(sticker));
    });

    client.on(Events.GuildRoleCreate, role => {
      void EventBus.post(new RoleCreatedEvent(role));
    });

    client.on(Events.GuildRoleUpdate, (oldRole, newRole) => {
      void EventBus.post(new RoleUpdatedEvent(oldRole, newRole));
    });

    client.on(Events.GuildRoleDelete, role => {
      void EventBus.post(new RoleDeletedEvent(role));
    });

    client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
      // `roles.cache` includes @everyone for both members, so it cancels out
      // and never shows as a spurious addition or removal.
      const oldRoleIds = new Set(oldMember.roles.cache.keys());
      const newRoleIds = new Set(newMember.roles.cache.keys());
      const added = newMember.roles.cache.filter(role => !oldRoleIds.has(role.id));
      const removed = oldMember.roles.cache.filter(role => !newRoleIds.has(role.id));
      if (added.size > 0 || removed.size > 0) {
        void EventBus.post(new MemberRolesUpdatedEvent(oldMember, newMember, added, removed));
      }
      if (oldMember.avatar !== newMember.avatar && !newMember.user.bot) {
        void EventBus.post(new UserAvatarUpdatedEvent(newMember.guild, oldMember.user, newMember.user));
      }
      if (oldMember.nickname !== newMember.nickname) {
        void EventBus.post(new MemberNicknameUpdatedEvent(oldMember, newMember));
      }
    });

    client.on(Events.UserUpdate, (oldUser, newUser) => {
      if (newUser.bot) {
        return;
      }
      const avatarChanged = oldUser.avatar !== newUser.avatar;
      const usernameChanged = oldUser.username !== newUser.username;
      const displayNameChanged = oldUser.globalName !== newUser.globalName;
      if (!avatarChanged && !usernameChanged && !displayNameChanged) {
        return;
      }
      // Global user changes arrive without a guild, so fan them out to the
      // mutual guilds the bot and user share for per-guild logging.
      this.fanOutToMutualGuilds(newUser.id, guild => {
        if (avatarChanged) {
          void EventBus.post(new UserAvatarUpdatedEvent(guild, oldUser, newUser));
        }
        if (usernameChanged) {
          void EventBus.post(new UserUsernameUpdatedEvent(guild, oldUser, newUser));
        }
        if (displayNameChanged) {
          void EventBus.post(new UserDisplayNameUpdatedEvent(guild, oldUser, newUser));
        }
      });
    });

    client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
      const user = newPresence.user;
      if (user?.bot) {
        return;
      }
      void EventBus.post(new UserPresenceChangedEvent(oldPresence, newPresence));
    });

    client.on(Events.InteractionCreate, interaction => {
      if (interaction.isChatInputCommand()) {
        void EventBus.post(new SlashCommandReceivedEvent(interaction));
      } else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
        void EventBus.post(new ContextMenuReceivedEvent(interaction));
      } else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
        void EventBus.post(new ComponentReceivedEvent(interaction));
      }
    });
  }

  /**
   * Run a callback for every mutual guild of the given user: a global user
   * change has no guild of its own, so per-guild consumers need one event
   * per shared guild.
   */
  private fanOutToMutualGuilds(userId: string, callback: (guild: Guild) => void): void {
    for (const guild of this.client.guilds.cache.values()) {
      if (guild.members.cache.has(userId)) {
        callback(guild);
      }
    }
  }
}

/**
 * Narrow a gateway channel to a guild channel, or `null` when it is a DM
 * (which has no guild and no place in guild-scoped events). Threads are
 * still guild channels at this point; callers filter them separately.
 */
function asGuildChannel(channel: DMChannel | NonThreadGuildBasedChannel): NonThreadGuildBasedChannel | null {
  return channel.isDMBased() ? null : channel;
}
