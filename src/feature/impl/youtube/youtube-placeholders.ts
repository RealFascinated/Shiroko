import type { PlaceholderContext } from "@/placeholder/placeholder";
import { definePlaceholder } from "@/placeholder/placeholder";
import PlaceholderExecutor from "@/placeholder/placeholder-executor";

/**
 * What an upload announcement template renders against. A YouTube upload has
 * no invoking member and no guild in the token itself, so the context extends
 * the base directly and carries only what these tokens read.
 */
export interface YoutubePlaceholderContext extends PlaceholderContext {
  readonly channelName: string;
  readonly videoTitle: string;
  readonly videoLink: string;
}

/**
 * The tokens an announcement template may contain. Built on the shared
 * placeholder engine like every other feature's, so `parse`/`has`/`catalog`
 * and the `{snake_case}` grammar come from one place instead of a local
 * renderer that could drift.
 */
export const youtubePlaceholders = new PlaceholderExecutor<YoutubePlaceholderContext>([
  definePlaceholder({
    key: "channel_name",
    description: "The YouTube channel's name.",
    resolve: context => context.channelName,
  }),
  definePlaceholder({
    key: "video_title",
    description: "The uploaded video's title.",
    resolve: context => context.videoTitle,
  }),
  definePlaceholder({
    key: "video_link",
    description: "A link to the uploaded video.",
    resolve: context => context.videoLink,
  }),
]);
