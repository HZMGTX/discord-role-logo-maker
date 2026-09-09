import {
  blendToComposite,
  hasEffects,
  isDestructive,
  type IconState,
  type Layer,
} from '../model/types';
import { blit, contextScale, withScratch, type Scratch } from './buffer';
import { withAlpha } from './color';
import { drawContent, type ContentResult } from './content';
import { makeFill } from './fills';
import { shapeBox, shapePath, type Box } from './shapes';

export type RenderResult = ContentResult;

const TAU = Math.PI * 2;
const NOTHING: ContentResult = { pending: false, emojiFallback: false };

function merge(a: ContentResult, b: ContentResult): ContentResult {
  return { pending: a.pending || b.pending, emojiFallback: a.emojiFallback || b.emojiFallback };
}

/** Moves the origin to where the layer's artwork is centered. */
function positionLayer(ctx: CanvasRenderingContext2D, layer: Layer, box: Box): void {
  const t = layer.transform;
  ctx.translate(box.x + box.s / 2 + t.x * box.s, box.y + box.s / 2 + t.y * box.s);
  ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.flipX || t.flipY) ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
}

/**
 * Draws a layer's artwork alone: no effects, no blending, no clipping.
 *
 * `scale` is how many bitmap pixels the destination puts on a logical pixel.
 * Canvas measures shadow blur and offsets in bitmap pixels and ignores the
 * current transform, so every shadow distance is multiplied by it. Without
 * that, a shadow drawn into the retina preview would come out half the size
 * of the same shadow in the exported PNG.
 */
function paintArtwork(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  box: Box,
  size: number,
  scale: number,
  { silhouetteOnly = false }: { silhouetteOnly?: boolean } = {},
): ContentResult {
  ctx.save();
  positionLayer(ctx, layer, box);
  // A canvas shadow is part of the drawing, not a pass behind it, so a layer
  // used as a mask must be painted without one: its shadow would swell the
  // mask well past the shape the user can see.
  if (!silhouetteOnly && 'shadow' in layer.content && layer.content.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 0.04 * size * scale;
    ctx.shadowOffsetY = 0.02 * size * scale;
  }
  const result = drawContent(ctx, layer.content, box, layer.transform.scale);
  ctx.restore();
  return result;
}

/**
 * A layer needs a scratch buffer when it carries an effect, is masked by
 * another layer, or blends destructively. Everything else is painted straight
 * onto the icon, exactly as it was before effects existed.
 */
function needsScratch(layer: Layer): boolean {
  return hasEffects(layer.effects) || layer.clipTo !== null || isDestructive(layer.blend);
}

/** Recolors a buffer's silhouette in place, keeping its alpha. */
function recolor(scratch: Scratch, color: string, alpha: number, size: number): void {
  const { ctx } = scratch;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

/**
 * Paints a halo and an outline underneath `art`, working in device pixels.
 * Canvas shadow offsets and blur are measured in bitmap units rather than the
 * current transform's units, so this runs with no transform at all and there
 * is nothing to convert.
 */
function paintDecoration(deco: Scratch, art: Scratch, layer: Layer, size: number): void {
  const { ctx } = deco;
  const { glow, outline } = layer.effects;
  const px = deco.px;
  const scale = deco.scale;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (glow) {
    ctx.save();
    ctx.globalAlpha = glow.opacity;
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = glow.blur * size * scale;
    // Drawing the artwork paints its halo too; repeating deepens the halo
    // without touching the artwork, which is redrawn opaque further down.
    for (let pass = 0; pass < 3; pass += 1) ctx.drawImage(art.canvas, 0, 0);
    ctx.restore();
  }

  if (outline && outline.width > 0) {
    const radius = outline.width * size * scale;
    // Enough copies that the ring reads as a smooth edge at any thickness.
    const steps = Math.max(12, Math.min(48, Math.round(radius * 6)));
    // The artwork is drawn off the bitmap so only its hard-edged shadow lands.
    const far = px * 2;
    ctx.save();
    ctx.shadowColor = outline.color;
    ctx.shadowBlur = 0;
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * TAU;
      ctx.shadowOffsetX = far + Math.cos(angle) * radius;
      ctx.shadowOffsetY = Math.sin(angle) * radius;
      ctx.drawImage(art.canvas, -far, 0);
    }
    ctx.restore();
  }

  ctx.drawImage(art.canvas, 0, 0);
  ctx.restore();
}

function drawLayerDirect(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  box: Box,
  clipPath: Path2D | null,
  size: number,
  scale: number,
): ContentResult {
  ctx.save();
  if (layer.clip && clipPath) ctx.clip(clipPath);
  ctx.globalAlpha = layer.transform.opacity;
  ctx.globalCompositeOperation = blendToComposite(layer.blend);
  const result = paintArtwork(ctx, layer, box, size, scale);
  ctx.restore();
  return result;
}

function drawLayerBuffered(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  mask: Layer | null,
  box: Box,
  clipPath: Path2D | null,
  size: number,
  scale: number,
  owner: Document,
): ContentResult | null {
  return withScratch(owner, size, scale, (art) => {
    // The drop shadow is cast when the finished buffer lands on the icon, not
    // inside it: a tint fills the whole buffer through source-atop and would
    // otherwise recolor the shadow along with the artwork.
    let result = paintArtwork(art.ctx, layer, box, size, art.scale, { silhouetteOnly: true });

    const { tint } = layer.effects;
    if (tint) recolor(art, tint.color, tint.amount, size);

    if (mask) {
      // The mask contributes only its shape. Its own effects, blend mode and
      // clipping are ignored, so two layers can point at each other safely.
      const masked = withScratch(owner, size, scale, (stencil) => {
        const r = paintArtwork(stencil.ctx, mask, box, size, stencil.scale, {
          silhouetteOnly: true,
        });
        art.ctx.save();
        art.ctx.globalCompositeOperation = 'destination-in';
        blit(art.ctx, stencil, size);
        art.ctx.restore();
        return r;
      });
      if (masked) result = merge(result, masked);
    }

    // Composing happens while the buffer is still checked out of the pool.
    const destructive = isDestructive(layer.blend);
    const compose = (source: Scratch) => {
      ctx.save();
      // Erase and stencil take pixels away, so they are always confined to the
      // silhouette however the layer's own clip switch is set. Unconfined, a
      // stencil layer would wipe the whole canvas.
      if (clipPath && (layer.clip || destructive)) ctx.clip(clipPath);
      ctx.globalAlpha = layer.transform.opacity;
      ctx.globalCompositeOperation = blendToComposite(layer.blend);
      // A shadow is part of what gets composited, so a layer that removes
      // pixels would erase through its own shadow. Skip it for those.
      if (!destructive && 'shadow' in layer.content && layer.content.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 0.04 * size * scale;
        ctx.shadowOffsetY = 0.02 * size * scale;
      }
      blit(ctx, source, size);
      ctx.restore();
    };

    const { glow, outline } = layer.effects;
    if (glow || outline) {
      const done = withScratch(owner, size, scale, (deco) => {
        paintDecoration(deco, art, layer, size);
        compose(deco);
        return true;
      });
      if (!done) compose(art);
    } else {
      compose(art);
    }
    return result;
  });
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
  const scale = contextScale(ctx);
  // Scratch canvases are created in the same document as the target, so the
  // renderer keeps working outside the main window.
  const owner = ctx.canvas.ownerDocument;
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
      ctx.shadowBlur = bg.shadow.blur * size * scale;
      ctx.shadowOffsetX = bg.shadow.dx * size * scale;
      ctx.shadowOffsetY = bg.shadow.dy * size * scale;
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

  const byId = new Map(state.layers.map((layer) => [layer.id, layer]));
  let result = NOTHING;
  for (const layer of state.layers) {
    if (layer.hidden || layer.transform.opacity <= 0 || layer.content.kind === 'none') continue;
    const target = layer.clipTo === null ? null : (byId.get(layer.clipTo) ?? null);
    // An empty mask layer would blank whatever it masks, which reads as a bug.
    const mask = target && target.content.kind !== 'none' ? target : null;
    const drawn = needsScratch(layer)
      ? drawLayerBuffered(ctx, layer, mask, box, path, size, scale, owner)
      : null;
    // No scratch canvas available: draw straight on rather than skip the layer.
    result = merge(result, drawn ?? drawLayerDirect(ctx, layer, box, path, size, scale));
  }

  // Stroked last, so a layer that erases pixels can never eat the border.
  if (path && bg.border.width > 0) {
    ctx.save();
    ctx.clip(path);
    ctx.lineWidth = bg.border.width * 2 * size;
    ctx.strokeStyle = bg.border.color;
    ctx.stroke(path);
    ctx.restore();
  }

  ctx.restore();
  return result;
}
