import Canvas from "@/lib/canvas";

export interface WelcomeCardData {
  name: string;
  avatarUrl: string | null;
  lines: readonly [string, string, string];
  accent: string;
}

const WIDTH = 900;
const HEIGHT = 330;
const AVATAR_SIZE = 140;

export async function renderWelcomeCard(data: WelcomeCardData): Promise<Buffer> {
  const canvas = new Canvas(WIDTH, HEIGHT).background("#1a1626");
  const centerX = WIDTH / 2;
  await canvas.avatar(data.avatarUrl, data.name, centerX - AVATAR_SIZE / 2, 36, AVATAR_SIZE, data.accent);
  const [line1, line2, line3] = data.lines;
  canvas.centeredText(canvas.fitText(line1, 800, 16, 700), centerX, 216, 16, data.accent, 700);
  canvas.centeredText(canvas.fitText(line2, 800, 38, 700), centerX, 260, 38, "#ffffff", 700);
  canvas.centeredText(canvas.fitText(line3, 800, 20, 500), centerX, 296, 20, "rgba(255, 255, 255, 0.6)", 500);
  return canvas.png();
}
