import Canvas, { CardColors } from "@/lib/canvas";

export interface WelcomeCardData {
  name: string;
  avatarUrl: string | null;
  lines: readonly [string, string, string];
  accent: string;
}

const WIDTH = 900;
const HEIGHT = 216;
const AVATAR_SIZE = 136;

export async function renderWelcomeCard(data: WelcomeCardData): Promise<Buffer> {
  const canvas = new Canvas(WIDTH, HEIGHT).card();
  canvas.avatar(
    await Canvas.loadImage(data.avatarUrl),
    data.name,
    40,
    (HEIGHT - AVATAR_SIZE) / 2,
    AVATAR_SIZE
  );
  const x = 40 + AVATAR_SIZE + 32;
  const maxWidth = WIDTH - 40 - x;
  const [line1, line2, line3] = data.lines;
  canvas.label(canvas.fitText(line1, maxWidth, 13, 600), x, 78, data.accent, 13);
  canvas.text(canvas.fitText(line2, maxWidth, 34, 700), x, 124, 34, CardColors.text, 700);
  canvas.text(canvas.fitText(line3, maxWidth, 18, 500), x, 156, 18, CardColors.muted, 500);
  return canvas.png();
}
