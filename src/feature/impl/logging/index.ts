import { Cache } from "@/cache/cache";
import { Caches } from "@/cache/index";
import { guildKey } from "@/cache/key";
import { db } from "@/db";
import { logsSchema } from "@/db/schemas/logs";
import { EventHandler } from "@/event/event-handler";
import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import SettingsModule from "@/settings/settings-module";
import { and, eq } from "drizzle-orm";
import { ChannelType, type Guild, type TextChannel } from "discord.js";
import { TimeUnit } from "@/lib/time";
import { baseEmbed } from "@/lib/embed";
import SettingsManager from "@/settings";

type LogsSettingsData = {
  channelId: string | null;
};

export const logsSettings = new SettingsModule<LogsSettingsData>({
  id: "logs",
  displayName: "Logs",
  featureId: FeatureIds.Logging,
  defaults: {
    channelId: null,
  },
  descriptors: [
    {
      key: "channelId",
      label: "Channel",
      description: "The channel where the logs are sent",
      type: "channel",
      default: null,
    },
  ],
});

export enum LogType {
  MemberJoin = "member_join"
}

export default class LoggingFeature extends Feature {
  private readonly CACHE = Caches.register(
    new Cache<boolean>({ name: "logging", mode: "authoritative", ttlMs: TimeUnit.toMillis(TimeUnit.Minute, 30) })
  );

  constructor() {
    super(FeatureIds.Logging, { name: "Logging", emoji: "📔" });
    SettingsManager.register(logsSettings);
  }

  /**
   * Whether a log type is enabled for a guild. Absence of a row means the
   * log type is off.
   */
  public async isEnabled(guild: Guild, logType: LogType): Promise<boolean> {
    return this.CACHE.load(guildKey(guild.id, logType), async () => {
      const rows = await db
        .select({ enabled: logsSchema.enabled })
        .from(logsSchema)
        .where(and(eq(logsSchema.guildId, guild.id), eq(logsSchema.logType, logType)));
      return rows[0]?.enabled ?? true;
    });
  }

  public async getLogsChannel(guild: Guild): Promise<TextChannel | null> {
    const channelId = await logsSettings.get(guild.id, "channelId");
    if (!channelId) {
      return null;
    }
    const channel = await guild.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }
    return channel;
  }

  public baseLogEmbed() {
    return baseEmbed();
  }


  /**
   * Send the welcome message to a member who just joined.
   */
  @EventHandler(MemberGuildJoinEvent, { featureId: FeatureIds.Welcomer })
  public async onMemberGuildJoin(event: MemberGuildJoinEvent): Promise<void> {
    if (!(await this.isEnabled(event.guild!, LogType.MemberJoin))) {
      return;
    }

    const channel = await this.getLogsChannel(event.guild!);
    if (!channel) {
      return;
    }

    await channel.send({ embeds: [this.baseLogEmbed().setDescription(`**${event.member.user.tag}** joined the server.`)] });
  }
}
