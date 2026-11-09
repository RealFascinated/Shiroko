import Canvas from "@/lib/canvas";

export interface LevelUpCardData {
  name: string;
  avatarUrl: string | null;
  prevLevel: number;
  newLevel: number;
}

const WIDTH = 900;
const HEIGHT = 200;
const ACCENT = "#9b59b6";
const TILE_Y = 52;
const TILE_WIDTH = 120;
const TILE_HEIGHT = 96;

export async function renderLevelUpCard(data: LevelUpCardData): Promise<Buffer> {
  const canvas = new Canvas(WIDTH, HEIGHT).background("#1a1626");
  await canvas.avatar(data.avatarUrl, data.name, 44, 44, 112, ACCENT);
  canvas.text("LEVEL UP", 184, 86, 16, ACCENT, 700);
  canvas.text(canvas.fitText(data.name, 340, 34, 700), 184, 126, 34, "#ffffff", 700);
  paintLevelTile(canvas, 556, data.prevLevel, "rgba(255, 255, 255, 0.06)", "rgba(255, 255, 255, 0.6)");
  canvas.centeredText("→", 706, 112, 32, "rgba(255, 255, 255, 0.55)", 700);
  paintLevelTile(canvas, 736, data.newLevel, ACCENT, "#ffffff");
  return canvas.png();
}

function paintLevelTile(canvas: Canvas, x: number, level: number, fill: string, color: string): void {
  const centerX = x + TILE_WIDTH / 2;
  canvas.roundedRect(x, TILE_Y, TILE_WIDTH, TILE_HEIGHT, 18, fill);
  canvas.centeredText("LEVEL", centerX, TILE_Y + 28, 13, color, 500);
  canvas.centeredText(String(level), centerX, TILE_Y + 78, 44, color, 700);
}
