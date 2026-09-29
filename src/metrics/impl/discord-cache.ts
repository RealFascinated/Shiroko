import { type Client, type Collection, type Guild, type Snowflake } from "discord.js";
import { Metric } from "../metric";

/** One named Discord.js manager cache; `size` reads its live entry count. */
interface DiscordCache {
  readonly name: string;
  readonly size: (client: Client) => number;
}

/** Sum a guild-scoped cache across every guild, i.e. its real memory footprint. */
function guildTotal<T>(client: Client, pick: (guild: Guild) => Collection<Snowflake, T>): number {
  let total = 0;
  for (const guild of client.guilds.cache.values()) {
    total += pick(guild).size;
  }
  return total;
}

/**
 * The client caches the bot populates under its current intents. Caches the
 * client leaves empty (`bans`, `scheduled_events`, `stage_instances`) and the
 * per-channel `messages` cache are excluded: they would be flat zero series.
 */
const DISCORD_CACHES: readonly DiscordCache[] = [
  { name: "users", size: client => client.users.cache.size },
  { name: "guilds", size: client => client.guilds.cache.size },
  { name: "members", size: client => guildTotal(client, guild => guild.members.cache) },
  { name: "channels", size: client => client.channels.cache.size },
  { name: "roles", size: client => guildTotal(client, guild => guild.roles.cache) },
  { name: "presences", size: client => guildTotal(client, guild => guild.presences.cache) },
  { name: "voice_states", size: client => guildTotal(client, guild => guild.voiceStates.cache) },
  { name: "emojis", size: client => guildTotal(client, guild => guild.emojis.cache) },
  { name: "stickers", size: client => guildTotal(client, guild => guild.stickers.cache) },
  { name: "invites", size: client => guildTotal(client, guild => guild.invites.cache) },
];

/**
 * Discord.js client cache occupancy, one series per cache:
 * `discord_cache_entries{cache="members",job="arona"} 4210`. The guild-scoped
 * caches are summed across guilds so the series tracks the process's real
 * held entries, not a single guild's view.
 *
 * Members and presences dominate memory, so a sustained climb in either is
 * the first sign that the default (unlimited) cache limits need sweeping.
 * Distinct from `cache_entries` (the in-process `Cache<V>` registry).
 */
export class DiscordCacheMetric extends Metric<Record<string, number>> {
  public override readonly collectIntervalMs = 30_000;
  private readonly client: Client;

  public constructor(client: Client) {
    super({
      id: "discord_cache_entries",
      kind: "counter_map",
      label: "cache",
      help: "Entries held in each Discord.js client cache",
    });
    this.client = client;
  }

  public value(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const cache of DISCORD_CACHES) {
      out[cache.name] = cache.size(this.client);
    }
    return out;
  }
}
