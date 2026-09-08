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

let fontsRegistered = false;

/**
 * Register bundled fonts once per process.
 */
function ensureFonts(): void {
  if (fontsRegistered) {
    return;
  }
  GlobalFonts.registerFromPath("assets/fonts/Geist.ttf", CANVAS_FONT);
  fontsRegistered = true;
}

/**
 * Font weight accepted by canvas font strings.
 */
export type CanvasFontWeight = 400 | 500 | 700;

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

  /**
   * Fill the whole canvas with `color`.
   */
  public background(color: string): this {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    return this;
  }

  /**
   * Draw `text` at `(x, y)` in the bundled font.
   */
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

  /**
   * Draw `text` centered on `centerX`, returning its rendered width.
   */
  public centeredText(
    text: string,
    centerX: number,
    y: number,
    size: number,
    color: string,
    weight: CanvasFontWeight = 400
  ): number {
    this.ctx.font = `${weight} ${size}px "${CANVAS_FONT}"`;
    const width = this.ctx.measureText(text).width;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, centerX - width / 2, y);
    return width;
  }

  /**
   * Shorten `text` with an ellipsis until it fits `maxWidth`.
   */
  public fitText(text: string, maxWidth: number, size: number, weight: CanvasFontWeight = 400): string {
    this.ctx.font = `${weight} ${size}px "${CANVAS_FONT}"`;
    if (this.ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    let shortened = text;
    while (shortened.length > 1 && this.ctx.measureText(`${shortened}…`).width > maxWidth) {
      shortened = shortened.slice(0, -1);
    }
    return `${shortened}…`;
  }

  /**
   * Fill a rounded rectangle.
   */
  public roundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: string
  ): this {
    this.ctx.fillStyle = color;
    const r = Math.min(radius, width / 2, height / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + width, y, x + width, y + height, r);
    this.ctx.arcTo(x + width, y + height, x, y + height, r);
    this.ctx.arcTo(x, y + height, x, y, r);
    this.ctx.arcTo(x, y, x + width, y, r);
    this.ctx.closePath();
    this.ctx.fill();
    return this;
  }

  /**
   * Draw `image` clipped to a circle centered at `(x, y)`.
   */
  public circleImage(image: Image, x: number, y: number, radius: number): this {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.clip();
    this.ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
    this.ctx.restore();
    return this;
  }

  /**
   * Stroke a circle outline centered at `(x, y)`.
   */
  public circleOutline(x: number, y: number, radius: number, color: string, width: number): this {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    return this;
  }

  /**
   * Encode the canvas as a PNG buffer.
   */
  public async png(): Promise<Buffer> {
    return this.canvas.encode("png");
  }

  /**
   * Fetch a URL as a canvas image, or `null` when unavailable.
   */
  public static async loadImage(url: string): Promise<Image | null> {
    try {
      return (await loadImage(url)) as unknown as Image;
    } catch {
      return null;
    }
  }
}
