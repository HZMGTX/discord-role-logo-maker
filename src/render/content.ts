import { twemojiUrl } from '../emoji/twemoji';
import { fontById, type Content, type FontWeight } from '../model/types';
import { resources } from './resources';
import type { Box } from './shapes';
import { SYMBOLS, partPath } from './symbols';

const EMOJI_FALLBACK_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

export interface ContentResult {
  /** A resource the content needs is still loading; re-render when it arrives. */
  pending: boolean;
  /** Emoji art could not be loaded, so the system emoji font was used instead. */
  emojiFallback: boolean;
}

const DONE: ContentResult = { pending: false, emojiFallback: false };

/**
 * Draws the content layer. The context must already be translated to the
 * content center and rotated; `scale` is the user's content scale.
 */
export function drawContent(
  ctx: CanvasRenderingContext2D,
  content: Content,
  box: Box,
  scale: number,
): ContentResult {
  const span = box.s * scale;
  switch (content.kind) {
    case 'emoji':
      return drawEmoji(ctx, content.emoji, span * 0.62);
    case 'text':
      return drawText(ctx, content, span);
    case 'symbol':
      drawSymbol(ctx, content, span * 0.62);
      return DONE;
    case 'image':
      return drawImage(ctx, content, span);
    case 'none':
      return DONE;
  }
}

/** Vertical offset that centers `text` on y=0 with an alphabetic baseline. */
function centeredBaseline(ctx: CanvasRenderingContext2D, text: string): number {
  const m = ctx.measureText(text);
  return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
}

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, size: number): ContentResult {
  const url = twemojiUrl(emoji);
  const image = resources.getImage(url);
  if (image) {
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    return DONE;
  }
  if (resources.imageStatus(url) === 'error') {
    ctx.font = `${Math.round(size * 0.85)}px ${EMOJI_FALLBACK_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000000';
    ctx.fillText(emoji, 0, centeredBaseline(ctx, emoji));
    return { pending: false, emojiFallback: true };
  }
  return { pending: true, emojiFallback: false };
}

function pickWeight(available: readonly number[], wanted: FontWeight): number {
  if (available.includes(wanted)) return wanted;
  return available.reduce(
    (best, w) => (Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best),
    available[0] ?? 400,
  );
}

function drawText(
  ctx: CanvasRenderingContext2D,
  content: Extract<Content, { kind: 'text' }>,
  span: number,
): ContentResult {
  const text = content.text.trim();
  if (!text) return DONE;
  const font = fontById(content.font);
  const weight = pickWeight(font.weights, content.weight);
  const family = `"${font.family}", sans-serif`;
  if (!resources.ensureFont(`${weight} 32px "${font.family}"`)) {
    return { pending: true, emojiFallback: false };
  }

  const chars = Array.from(text);
  const maxWidth = span * 0.8;
  let fontSize = span * 0.55;
  const setFont = () => {
    ctx.font = `${weight} ${fontSize}px ${family}`;
  };
  const measure = () => {
    const spacing = content.letterSpacing * fontSize;
    const advances = chars.map((ch) => ctx.measureText(ch).width);
    const width = advances.reduce((sum, w) => sum + w, 0) + spacing * (chars.length - 1);
    return { spacing, advances, width };
  };

  setFont();
  let metrics = measure();
  if (metrics.width > maxWidth) {
    fontSize *= maxWidth / metrics.width;
    setFont();
    metrics = measure();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const y = centeredBaseline(ctx, text);
  const startX = -metrics.width / 2;

  const eachChar = (draw: (ch: string, x: number) => void) => {
    let x = startX;
    chars.forEach((ch, i) => {
      draw(ch, x);
      x += (metrics.advances[i] ?? 0) + metrics.spacing;
    });
  };

  if (content.stroke && content.stroke.width > 0) {
    ctx.strokeStyle = content.stroke.color;
    ctx.lineWidth = content.stroke.width * fontSize;
    eachChar((ch, x) => ctx.strokeText(ch, x, y));
  }
  ctx.fillStyle = content.color;
  eachChar((ch, x) => ctx.fillText(ch, x, y));
  return DONE;
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  content: Extract<Content, { kind: 'symbol' }>,
  size: number,
): void {
  const def = SYMBOLS[content.symbol];
  ctx.save();
  ctx.scale(size, size);
  ctx.translate(-0.5, -0.5);
  ctx.fillStyle = content.color;
  ctx.strokeStyle = content.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const part of def.parts) {
    const path = partPath(part);
    if (part.mode === 'fill') {
      ctx.fill(path, part.fillRule ?? 'nonzero');
    } else {
      ctx.lineWidth = part.width ?? 0.1;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  content: Extract<Content, { kind: 'image' }>,
  span: number,
): ContentResult {
  if (!content.src) return DONE;
  const image = resources.getImage(content.src);
  if (!image) {
    return { pending: resources.imageStatus(content.src) === 'loading', emojiFallback: false };
  }
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  if (!iw || !ih) return DONE;
  const ratio =
    content.fit === 'cover' ? Math.max(span / iw, span / ih) : Math.min(span / iw, span / ih);
  const w = iw * ratio;
  const h = ih * ratio;
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  return DONE;
}
