import type { Fill } from '../model/types';
import type { Box } from './shapes';

/** A canvas fill style for the shape layer. */
export function makeFill(
  ctx: CanvasRenderingContext2D,
  fill: Fill,
  box: Box,
): string | CanvasGradient {
  if (fill.type === 'solid') return fill.color1;
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;
  if (fill.type === 'radial') {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, box.s * 0.55);
    g.addColorStop(0, fill.color1);
    g.addColorStop(1, fill.color2);
    return g;
  }
  // CSS convention: 0deg points up, 90deg points right.
  const theta = (fill.angle * Math.PI) / 180;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const half = (box.s * Math.abs(sin) + box.s * Math.abs(cos)) / 2;
  const g = ctx.createLinearGradient(
    cx - sin * half,
    cy + cos * half,
    cx + sin * half,
    cy - cos * half,
  );
  g.addColorStop(0, fill.color1);
  g.addColorStop(1, fill.color2);
  return g;
}
