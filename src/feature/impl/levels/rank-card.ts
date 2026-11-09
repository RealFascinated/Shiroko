import Canvas, { CardColors } from "@/lib/canvas";
import { formatCount } from "@/lib/format";

/**
 * A configured role reward: the level that grants it and the role's name
 * when it can be resolved (a deleted or uncached role leaves it null).
 */
export interface RankCardReward {
  level: number;
  roleName: string | null;
}

/**
 * Everything a rank card paints: who it is for, where they sit on the
 * guild board, and how far their current level has come along.
 */
export interface RankCardData {
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  guildRank: number | null;
  totalTracked: number;
  reward: RankCardReward | null;
}

const WIDTH = 900;
const ACCENT = "#9b59b6";
const PODIUM_ACCENTS = ["#ffd700", "#c0c0c0", "#cd7f32"];
const MARGIN = 40;
const RIGHT = WIDTH - MARGIN;
const AVATAR_SIZE = 112;
const CONTENT_X = MARGIN + AVATAR_SIZE + 24;
const TILE_WIDTH = 116;

export async function renderRankCard(data: RankCardData): Promise<Buffer> {
  const accent = accentFor(data.guildRank);
  const canvas = new Canvas(WIDTH, data.reward ? 296 : 262).card();
  canvas.avatar(await Canvas.loadImage(data.avatarUrl), data.name, MARGIN, MARGIN, AVATAR_SIZE);
  paintLevelTile(canvas, data.level, accent);
  paintIdentity(canvas, data, accent);
  canvas.line(MARGIN, 184.5, RIGHT, 184.5, CardColors.rule);
  paintProgress(canvas, data, accent);
  if (data.reward) {
    canvas.label("Next reward", MARGIN, 272);
    canvas.text(
      canvas.fitText(rewardLine(data.reward), RIGHT - MARGIN - 120, 15, 500),
      MARGIN + 120,
      272,
      15,
      CardColors.muted,
      500
    );
  }
  return canvas.png();
}

function paintLevelTile(canvas: Canvas, level: number, accent: string): void {
  const x = RIGHT - TILE_WIDTH;
  const ink = inkOn(accent);
  canvas.roundedRect(x, MARGIN, TILE_WIDTH, AVATAR_SIZE, 12, accent);
  canvas.label("Level", x + 16, MARGIN + 28, ink, 11);
  canvas.text(String(level), x + 14, MARGIN + AVATAR_SIZE - 18, 52, ink, 700);
}

function paintIdentity(canvas: Canvas, data: RankCardData, accent: string): void {
  const maxWidth = RIGHT - TILE_WIDTH - 24 - CONTENT_X;
  canvas.text(canvas.fitText(data.name, maxWidth, 30, 700), CONTENT_X, 86, 30, CardColors.text, 700);
  if (data.guildRank === null) {
    canvas.text(
      "Not ranked yet; send a message to start earning XP",
      CONTENT_X,
      116,
      16,
      CardColors.muted,
      500
    );
    return;
  }
  const rank = `#${data.guildRank}`;
  canvas.text(rank, CONTENT_X, 116, 16, accent, 600);
  canvas.text(
    ` of ${formatCount(data.totalTracked)} in this server · ${formatCount(data.xp)} XP total`,
    CONTENT_X + canvas.measure(rank, 16, 600),
    116,
    16,
    CardColors.muted,
    500
  );
}

function paintProgress(canvas: Canvas, data: RankCardData, accent: string): void {
  const earned = data.xp - data.currentLevelXp;
  const span = data.nextLevelXp - data.currentLevelXp;
  const width = RIGHT - MARGIN;
  const earnedText = formatCount(earned);
  canvas.text(earnedText, MARGIN, 220, 16, CardColors.text, 600);
  canvas.text(
    ` / ${formatCount(span)} XP`,
    MARGIN + canvas.measure(earnedText, 16, 600),
    220,
    16,
    CardColors.muted,
    500
  );
  canvas.rightText(
    `${formatCount(span - earned)} XP to level ${data.level + 1}`,
    RIGHT,
    220,
    15,
    CardColors.muted,
    500
  );
  canvas.roundedRect(MARGIN, 234, width, 6, 3, CardColors.raised);
  if (data.progress > 0) {
    canvas.roundedRect(MARGIN, 234, Math.max(6, width * data.progress), 6, 3, accent);
  }
}

function accentFor(guildRank: number | null): string {
  return guildRank !== null && guildRank <= 3 ? PODIUM_ACCENTS[guildRank - 1]! : ACCENT;
}

/**
 * Text colour that stays legible on an `accent` fill: dark on the light
 * podium metals, light on the brand purple.
 */
function inkOn(accent: string): string {
  const rgb = Bun.color(accent, "{rgb}");
  const luma = rgb ? (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 : 0;
  return luma > 0.5 ? CardColors.base : CardColors.text;
}

function rewardLine(reward: RankCardReward): string {
  return reward.roleName ? `Level ${reward.level} · ${reward.roleName}` : `Level ${reward.level}`;
}
