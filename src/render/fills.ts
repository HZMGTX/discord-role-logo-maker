import type { Fill } from '../model/types';
import type { Box } from './shapes';

/**
 * Canvas gradients are bound to the context that created them, and this app
 * draws through several contexts (preview, Discord mocks, thumbnails, export),
 * so a fill is always rebuilt here and never cached.
 */
function addStops(gradient: CanvasGradient, fill: Fill): void {
  gradient.addColorStop(0, fill.color1);
  for (const stop of fill.stops) {
    // addColorStop throws on anything outside 0..1 or non-finite, which would
    // blank the whole icon. Presets and the reset button reach the renderer
    // without passing through sanitize, so clamp here as well.
    const offset = Number.isFinite(stop.offset) ? Math.min(1, Math.max(0, stop.offset)) : 0.5;
    gradient.addColorStop(offset, stop.color);
  }
  gradient.addColorStop(1, fill.color2);
}

type ConicCapable = CanvasRenderingContext2D & {
  createConicGradient?: (startAngle: number, x: number, y: number) => CanvasGradient;
};

/** A canvas fill style for a shape. */
export function makeFill(
  ctx: CanvasRenderingContext2D,
  fill: Fill,
  box: Box,
): string | CanvasGradient {
  if (fill.type === 'solid') return fill.color1;
  const cx = box.x + box.s / 2 + fill.cx * box.s;
  const cy = box.y + box.s / 2 + fill.cy * box.s;
  // CSS convention: 0deg points up, 90deg points right.
  const theta = (fill.angle * Math.PI) / 180;

  if (fill.type === 'conic') {
    const create = (ctx as ConicCapable).createConicGradient;
    if (typeof create === 'function') {
      // Canvas measures the start angle from the positive x axis, so turn it
      // a quarter turn to match the "0deg points up" convention above.
      const gradient = create.call(ctx, theta - Math.PI / 2, cx, cy);
      addStops(gradient, fill);
      return gradient;
    }
    // Older browsers have no conic gradient; a radial one still reads as a blend.
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, box.s * fill.radius);
    addStops(gradient, fill);
    return gradient;
  }

  if (fill.type === 'radial') {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, box.s * fill.radius);
    addStops(gradient, fill);
    return gradient;
  }

  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const half = (box.s * Math.abs(sin) + box.s * Math.abs(cos)) / 2;
  const gradient = ctx.createLinearGradient(
    cx - sin * half,
    cy + cos * half,
    cx + sin * half,
    cy - cos * half,
  );
  addStops(gradient, fill);
  return gradient;
}
