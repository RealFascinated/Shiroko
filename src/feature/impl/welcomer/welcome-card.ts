import Canvas from "@/lib/canvas";
import { formatCount } from "@/lib/format";

export interface WelcomeCardData {
  name: string;
  avatarUrl: string | null;
  guildName: string;
  memberCount: number;
  accent: string;
}

const WIDTH = 900;
const HEIGHT = 330;
const AVATAR_SIZE = 140;

export async function renderWelcomeCard(data: WelcomeCardData): Promise<Buffer> {
  const canvas = new Canvas(WIDTH, HEIGHT).background("#1a1626");
  const centerX = WIDTH / 2;
  await canvas.avatar(data.avatarUrl, data.name, centerX - AVATAR_SIZE / 2, 36, AVATAR_SIZE, data.accent);
  canvas.centeredText("WELCOME", centerX, 216, 16, data.accent, 700);
  canvas.centeredText(canvas.fitText(data.name, 800, 38, 700), centerX, 260, 38, "#ffffff", 700);
  const memberLine = `Member #${formatCount(data.memberCount)} of ${data.guildName}`;
  canvas.centeredText(
    canvas.fitText(memberLine, 800, 20, 500),
    centerX,
    296,
    20,
    "rgba(255, 255, 255, 0.6)",
    500
  );
  return canvas.png();
}
