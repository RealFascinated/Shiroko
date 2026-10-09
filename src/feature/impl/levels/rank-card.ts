import Canvas from "@/lib/canvas";

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
  nextLevelXp: number;
  progress: number;
  guildRank: number | null;
  totalTracked: number;
  reward: RankCardReward | null;
}

const WIDTH = 900;
const HEIGHT = 290;
const ACCENT = "#9b59b6";
const PODIUM_ACCENTS = ["#ffd700", "#c0c0c0", "#cd7f32"];

export async function renderRankCard(data: RankCardData): Promise<Buffer> {
  const accent = accentFor(data.guildRank);
  const canvas = new Canvas(WIDTH, HEIGHT).background("#1a1626");
  await paintHeader(canvas, data, accent);
  paintLevelTile(canvas, data);
  paintProgress(canvas, data, accent);
  paintDetails(canvas, data, accent);
  return canvas.png();
}

async function paintHeader(canvas: Canvas, data: RankCardData, accent: string): Promise<void> {
  const size = 96;
  const x = 48;
  const y = 38;
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const avatar = data.avatarUrl ? await Canvas.loadImage(data.avatarUrl) : null;
  if (avatar) {
    canvas.circleImage(avatar, centerX, centerY, size / 2);
  } else {
    canvas
      .roundedRect(x, y, size, size, size / 2, "#2a2340")
      .centeredText(data.name.slice(0, 1).toUpperCase(), centerX, centerY + 16, 44, "#ffffff", 700);
  }
  canvas.circleOutline(centerX, centerY, size / 2 + 1, accent, 3);
  canvas.text(canvas.fitText(data.name, 416, 34, 700), x + size + 24, 78, 34, "#ffffff", 700);
  canvas.text(
    canvas.fitText(rankLine(data), 416, 20, 500),
    x + size + 24,
    118,
    20,
    "rgba(255, 255, 255, 0.7)",
    500
  );
}

function paintLevelTile(canvas: Canvas, data: RankCardData): void {
  canvas.roundedRect(608, 36, 244, 100, 18, "rgba(255, 255, 255, 0.06)");
  canvas.centeredText("LEVEL", 730, 68, 16, "rgba(255, 255, 255, 0.55)", 500);
  canvas.centeredText(String(data.level), 730, 120, 56, "#ffffff", 700);
}

function paintProgress(canvas: Canvas, data: RankCardData, accent: string): void {
  const width = 720;
  const height = 22;
  canvas.roundedRect(48, 180, width, height, height / 2, "rgba(255, 255, 255, 0.08)");
  canvas.roundedRect(48, 180, width * data.progress, height, height / 2, accent);
  canvas.text(`${Math.round(data.progress * 100)}%`, 792, 197, 22, accent, 700);
}

function paintDetails(canvas: Canvas, data: RankCardData, accent: string): void {
  const toGo = data.nextLevelXp - data.xp;
  const xpLine = `${formatCount(data.xp)} / ${formatCount(data.nextLevelXp)} XP · ${formatCount(toGo)} to go`;
  canvas.text(canvas.fitText(xpLine, 804, 20, 500), 48, 244, 20, "rgba(255, 255, 255, 0.75)", 500);
  if (data.reward) {
    canvas.text(canvas.fitText(rewardLine(data.reward), 804, 17, 500), 48, 274, 17, accent, 500);
  }
}

function accentFor(guildRank: number | null): string {
  return guildRank !== null && guildRank <= 3 ? PODIUM_ACCENTS[guildRank - 1]! : ACCENT;
}

function rankLine(data: RankCardData): string {
  return data.guildRank === null
    ? "Not ranked yet; send a message to start earning XP!"
    : `#${data.guildRank} of ${data.totalTracked} in this server`;
}

function rewardLine(reward: RankCardReward): string {
  return reward.roleName
    ? `Next reward at level ${reward.level} · ${reward.roleName}`
    : `Next reward at level ${reward.level}`;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
