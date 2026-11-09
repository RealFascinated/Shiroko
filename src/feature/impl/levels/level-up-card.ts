import Canvas, { CardColors } from "@/lib/canvas";

export interface LevelUpCardData {
  name: string;
  avatarUrl: string | null;
  prevLevel: number;
  newLevel: number;
}

const WIDTH = 760;
const HEIGHT = 160;
const ACCENT = "#9b59b6";
const MARGIN = 40;
const RIGHT = WIDTH - MARGIN;
const AVATAR_SIZE = 80;
const TILE_WIDTH = 96;
const ARROW_GAP = 44;

export async function renderLevelUpCard(data: LevelUpCardData): Promise<Buffer> {
  const canvas = new Canvas(WIDTH, HEIGHT).card();
  canvas.avatar(await Canvas.loadImage(data.avatarUrl), data.name, MARGIN, MARGIN, AVATAR_SIZE);
  const nextX = RIGHT - TILE_WIDTH;
  const prevX = nextX - ARROW_GAP - TILE_WIDTH;
  paintLevelTile(canvas, prevX, data.prevLevel, CardColors.raised, CardColors.faint);
  canvas.centeredText("→", prevX + TILE_WIDTH + ARROW_GAP / 2, 88, 20, CardColors.faint, 500);
  paintLevelTile(canvas, nextX, data.newLevel, ACCENT, CardColors.text);
  const x = MARGIN + AVATAR_SIZE + 20;
  canvas.label("Level up", x, 70, ACCENT);
  canvas.text(canvas.fitText(data.name, prevX - 24 - x, 26, 700), x, 102, 26, CardColors.text, 700);
  return canvas.png();
}

function paintLevelTile(canvas: Canvas, x: number, level: number, fill: string, color: string): void {
  canvas.roundedRect(x, MARGIN, TILE_WIDTH, AVATAR_SIZE, 12, fill);
  canvas.label("Level", x + 14, MARGIN + 22, color, 10);
  canvas.text(String(level), x + 12, MARGIN + AVATAR_SIZE - 14, 36, color, 700);
}
