/**
 * Scratch canvases for layers that cannot be painted straight onto the icon:
 * anything carrying an effect, masked by another layer, or using a blend mode
 * that removes pixels.
 *
 * Buffers are pooled and handed out strictly last-in-first-out, so a repaint
 * on every slider drag does not allocate. Nothing is cached between renders
 * except the canvas objects themselves: a canvas gradient belongs to the
 * context that made it, and this app draws through several contexts.
 */

export interface Scratch {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Side of the bitmap in device pixels. */
  px: number;
  /** Device pixels per logical pixel. */
  scale: number;
}

const pool: Scratch[] = [];
let live = 0;

/** Largest buffer we will allocate, so a hostile size cannot exhaust memory. */
const MAX_PX = 4096;

/**
 * How many device pixels the destination context puts on one logical pixel.
 * The live preview draws through a device-pixel-ratio transform; the export
 * canvas draws at 1:1.
 */
export function contextScale(ctx: CanvasRenderingContext2D): number {
  if (typeof ctx.getTransform !== 'function') return 1;
  const m = ctx.getTransform();
  const scale = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function take(): Scratch | null {
  const existing = pool[live];
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const scratch: Scratch = { canvas, ctx, px: 0, scale: 1 };
  pool.push(scratch);
  return scratch;
}

/**
 * Runs `draw` against a cleared buffer covering `size` logical pixels. The
 * buffer's context starts with the same scale as the destination, so callers
 * can keep using logical coordinates. Returns `null` if no canvas is
 * available, which lets the caller fall back to drawing directly.
 */
export function withScratch<T>(
  size: number,
  scale: number,
  draw: (scratch: Scratch) => T,
): T | null {
  const scratch = take();
  if (!scratch) return null;
  const px = Math.max(1, Math.min(MAX_PX, Math.ceil(size * scale)));
  live += 1;
  try {
    const { canvas, ctx } = scratch;
    if (canvas.width !== px || canvas.height !== px) {
      // Assigning either dimension clears the bitmap and resets the context.
      canvas.width = px;
      canvas.height = px;
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, px, px);
    }
    scratch.px = px;
    scratch.scale = px / size;
    ctx.setTransform(scratch.scale, 0, 0, scratch.scale, 0, 0);
    return draw(scratch);
  } finally {
    live -= 1;
  }
}

/**
 * Draws one buffer onto another so their bitmaps line up pixel for pixel.
 * `size` is the shared logical size, and the destination is assumed to be
 * drawing at the same scale.
 */
export function blit(ctx: CanvasRenderingContext2D, source: Scratch, size: number): void {
  ctx.drawImage(source.canvas, 0, 0, size, size);
}
