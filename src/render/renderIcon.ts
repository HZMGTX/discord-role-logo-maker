import { blendToComposite, type IconState, type Layer } from '../model/types';
import { withAlpha } from './color';
import { drawContent, type ContentResult } from './content';
import { makeFill } from './fills';
import { shapeBox, shapePath, type Box } from './shapes';

export type RenderResult = ContentResult;

const TAU = Math.PI * 2;

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  box: Box,
  clipPath: Path2D | null,
  size: number,
): ContentResult {
  const t = layer.transform;
  ctx.save();
  if (layer.clip && clipPath) ctx.clip(clipPath);
  ctx.globalAlpha = t.opacity;
  ctx.globalCompositeOperation = blendToComposite(layer.blend);
  ctx.translate(box.x + box.s / 2 + t.x * box.s, box.y + box.s / 2 + t.y * box.s);
  ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.flipX || t.flipY) ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
  if ('shadow' in layer.content && layer.content.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 0.04 * size;
    ctx.shadowOffsetY = 0.02 * size;
  }
  const result = drawContent(ctx, layer.content, box, t.scale);
  ctx.restore();
  return result;
}

/**
 * Draws the whole icon into a `size` x `size` CSS-pixel area: the background
 * plate, then every layer from bottom to top, then the border. The caller sets
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
  const bg = state.background;
  const path = shapePath(bg.shape, box, {
    cornerRadius: bg.cornerRadius,
    sides: bg.sides,
    innerRatio: bg.innerRatio,
    rotation: bg.rotation,
  });
  const cx = box.x + box.s / 2;

  if (path) {
    if (bg.shadow.enabled && bg.shadow.opacity > 0) {
      ctx.save();
      ctx.shadowColor = withAlpha(bg.shadow.color, bg.shadow.opacity);
      ctx.shadowBlur = bg.shadow.blur * size;
      ctx.shadowOffsetX = bg.shadow.dx * size;
      ctx.shadowOffsetY = bg.shadow.dy * size;
      ctx.fillStyle = bg.fill.color1;
      ctx.fill(path);
      ctx.restore();
    }

    ctx.fillStyle = makeFill(ctx, bg.fill, box);
    ctx.fill(path);

    if (bg.gloss) {
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

  let pending = false;
  let emojiFallback = false;
  for (const layer of state.layers) {
    if (layer.hidden || layer.transform.opacity <= 0 || layer.content.kind === 'none') continue;
    const result = drawLayer(ctx, layer, box, path, size);
    pending = pending || result.pending;
    emojiFallback = emojiFallback || result.emojiFallback;
  }

  if (path && bg.border.width > 0) {
    ctx.save();
    ctx.clip(path);
    ctx.lineWidth = bg.border.width * 2 * size;
    ctx.strokeStyle = bg.border.color;
    ctx.stroke(path);
    ctx.restore();
  }

  ctx.restore();
  return { pending, emojiFallback };
}
