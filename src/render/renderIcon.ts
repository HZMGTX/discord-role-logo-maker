import type { IconState } from '../model/types';
import { withAlpha } from './color';
import { drawContent, type ContentResult } from './content';
import { makeFill } from './fills';
import { shapeBox, shapePath } from './shapes';

export type RenderResult = ContentResult;

const TAU = Math.PI * 2;

/**
 * Draws the whole icon into a `size` x `size` CSS-pixel area. The caller sets
 * any device-pixel-ratio transform beforehand. The same function produces the
 * live preview, the Discord mock previews, preset thumbnails and the exported
 * PNG, so what you see is what you download.
 */
export function renderIcon(
  ctx: CanvasRenderingContext2D,
  state: IconState,
  size: number,
): RenderResult {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  const box = shapeBox(size);
  const path = shapePath(state.shape, box, state.cornerRadius);
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;

  if (path) {
    if (state.shadow.enabled && state.shadow.opacity > 0) {
      ctx.save();
      ctx.shadowColor = withAlpha(state.shadow.color, state.shadow.opacity);
      ctx.shadowBlur = state.shadow.blur * size;
      ctx.shadowOffsetX = state.shadow.dx * size;
      ctx.shadowOffsetY = state.shadow.dy * size;
      ctx.fillStyle = state.fill.color1;
      ctx.fill(path);
      ctx.restore();
    }

    ctx.fillStyle = makeFill(ctx, state.fill, box);
    ctx.fill(path);

    if (state.gloss) {
      ctx.save();
      ctx.clip(path);
      const gradient = ctx.createLinearGradient(0, box.y, 0, box.y + box.s * 0.62);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(cx, box.y + box.s * 0.32, box.s * 0.42, box.s * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  let result: RenderResult = { pending: false, emojiFallback: false };
  const t = state.transform;
  if (state.content.kind !== 'none' && t.opacity > 0) {
    ctx.save();
    const clip = path !== null && !(state.content.kind === 'image' && !state.content.clip);
    if (clip && path) ctx.clip(path);
    ctx.globalAlpha = t.opacity;
    ctx.translate(cx + t.x * box.s, cy + t.y * box.s);
    ctx.rotate((t.rotation * Math.PI) / 180);
    if ('shadow' in state.content && state.content.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 0.04 * size;
      ctx.shadowOffsetY = 0.02 * size;
    }
    result = drawContent(ctx, state.content, box, t.scale);
    ctx.restore();
  }

  if (path && state.border.width > 0) {
    ctx.save();
    ctx.clip(path);
    ctx.lineWidth = state.border.width * 2 * size;
    ctx.strokeStyle = state.border.color;
    ctx.stroke(path);
    ctx.restore();
  }

  ctx.restore();
  return result;
}
