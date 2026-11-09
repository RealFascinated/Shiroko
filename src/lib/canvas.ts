import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type Image,
  type Canvas as SkiaCanvas,
  type SKRSContext2D,
} from "@napi-rs/canvas";

/**
 * Bundled font family, registered from `assets/fonts` on first use.
 * Production images ship no system fonts, so canvas text silently renders
 * nothing without this.
 */
export const CANVAS_FONT = "Geist";

/**
 * The palette every card shares, so the cards read as one set.
 */
export const CardColors = {
  base: "#1b1a20",
  raised: "#26252c",
  inactive: "#38373f",
  text: "#f4f3f6",
  muted: "#a3a1ab",
  faint: "#6f6d78",
  rule: "#2e2d35",
} as const;

const CARD_RADIUS = 16;

let fontsRegistered = false;

function ensureFonts(): void {
  if (fontsRegistered) {
    return;
  }
  GlobalFonts.registerFromPath("assets/fonts/Geist.ttf", CANVAS_FONT);
  fontsRegistered = true;
}

export type CanvasFontWeight = 400 | 500 | 600 | 700;

/**
 * Thin wrapper over an `@napi-rs/canvas` 2d context: owns font
 * registration and the small drawing vocabulary every card reuses, so
 * cards never touch raw context state or font strings.
 */
export default class Canvas {
  private readonly canvas: SkiaCanvas;
  private readonly ctx: SKRSContext2D;

  constructor(width: number, height: number) {
    ensureFonts();
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext("2d");
  }

  public get width(): number {
    return this.canvas.width;
  }

  public get height(): number {
    return this.canvas.height;
  }

  /**
   * The shared card shape: rounded corners left transparent so the card
   * sits on Discord's own background, filled flat. Clips the rest of the
   * drawing to that shape, so call it first.
   */
  public card(): this {
    this.roundedPath(0, 0, this.width, this.height, CARD_RADIUS);
    this.ctx.clip();
    this.ctx.fillStyle = CardColors.base;
    this.ctx.fillRect(0, 0, this.width, this.height);
    return this;
  }

  public text(
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    weight: CanvasFontWeight = 400
  ): this {
    this.ctx.fillStyle = color;
    this.ctx.font = `${weight} ${size}px "${CANVAS_FONT}"`;
    this.ctx.fillText(text, x, y);
    return this;
  }

  public centeredText(
    text: string,
    centerX: number,
    y: number,
    size: number,
    color: string,
    weight: CanvasFontWeight = 400
  ): number {
    const width = this.measure(text, size, weight);
    this.text(text, centerX - width / 2, y, size, color, weight);
    return width;
  }

  public rightText(
    text: string,
    rightX: number,
    y: number,
    size: number,
    color: string,
    weight: CanvasFontWeight = 400
  ): number {
    const width = this.measure(text, size, weight);
    this.text(text, rightX - width, y, size, color, weight);
    return width;
  }

  /**
   * Small uppercase caption with open tracking, the style every card uses
   * to name a value.
   */
  public label(
    text: string,
    x: number,
    y: number,
    color: string = CardColors.faint,
    size: number = 12
  ): this {
    this.ctx.letterSpacing = "1.2px";
    this.text(text.toUpperCase(), x, y, size, color, 600);
    this.ctx.letterSpacing = "0px";
    return this;
  }

  public measure(text: string, size: number, weight: CanvasFontWeight = 400): number {
    this.ctx.font = `${weight} ${size}px "${CANVAS_FONT}"`;
    return this.ctx.measureText(text).width;
  }

  public fitText(text: string, maxWidth: number, size: number, weight: CanvasFontWeight = 400): string {
    if (this.measure(text, size, weight) <= maxWidth) {
      return text;
    }
    let shortened = text;
    while (shortened.length > 1 && this.ctx.measureText(`${shortened}…`).width > maxWidth) {
      shortened = shortened.slice(0, -1);
    }
    return `${shortened}…`;
  }

  public roundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: string
  ): this {
    this.ctx.fillStyle = color;
    this.roundedPath(x, y, width, height, radius);
    this.ctx.fill();
    return this;
  }

  public line(x1: number, y1: number, x2: number, y2: number, color: string, width: number = 1): this {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    return this;
  }

  /**
   * A rounded-square avatar with the name's initial as the fallback when
   * there is no image.
   */
  public avatar(image: Image | null, name: string, x: number, y: number, size: number): this {
    const radius = size * 0.16;
    if (!image) {
      this.roundedRect(x, y, size, size, radius, CardColors.raised);
      this.centeredText(
        name.slice(0, 1).toUpperCase(),
        x + size / 2,
        y + size * 0.67,
        size * 0.46,
        CardColors.muted,
        600
      );
      return this;
    }
    this.ctx.save();
    this.roundedPath(x, y, size, size, radius);
    this.ctx.clip();
    this.ctx.drawImage(image, x, y, size, size);
    this.ctx.restore();
    return this;
  }

  public async png(): Promise<Buffer> {
    return this.canvas.encode("png");
  }

  public static async loadImage(url: string | null): Promise<Image | null> {
    if (!url) {
      return null;
    }
    try {
      return (await loadImage(url)) as unknown as Image;
    } catch {
      return null;
    }
  }

  private roundedPath(x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + width, y, x + width, y + height, r);
    this.ctx.arcTo(x + width, y + height, x, y + height, r);
    this.ctx.arcTo(x, y + height, x, y, r);
    this.ctx.arcTo(x, y, x + width, y, r);
    this.ctx.closePath();
  }
}
