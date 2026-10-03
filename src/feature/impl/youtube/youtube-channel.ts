/**
 * A YouTube channel's identity, as the bot knows it. Used wherever only the
 * channel and its human-readable name are needed, so a raw `UC...` id is
 * never shown to a user.
 */
export interface YoutubeChannel {
  readonly id: string;
  readonly displayName: string;
}
