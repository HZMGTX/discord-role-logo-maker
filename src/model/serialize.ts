import { DEFAULT_BACKGROUND, DEFAULT_ICON, DEFAULT_PREVIEW, DEFAULT_TRANSFORM } from './defaults';
import {
  BLEND_MODES,
  FILL_TYPES,
  FONTS,
  FONT_WEIGHTS,
  IMAGE_FITS,
  MAX_LAYERS,
  RANGES,
  SHAPES,
  SYMBOL_IDS,
  isValidFontName,
  type Background,
  type BlendMode,
  type Border,
  type Content,
  type Fill,
  type FontId,
  type FontWeight,
  type IconState,
  type Layer,
  type PreviewSettings,
  type Range,
  type Transform,
} from './types';

const HEX = /^#[0-9a-f]{6}$/i;
const FONT_IDS: readonly FontId[] = FONTS.map((f) => f.id);

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function num(x: unknown, fallback: number, range?: Range): number {
  const n = typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  return range ? Math.min(range.max, Math.max(range.min, n)) : n;
}

function color(x: unknown, fallback: string): string {
  return typeof x === 'string' && HEX.test(x) ? x.toLowerCase() : fallback;
}

function bool(x: unknown, fallback: boolean): boolean {
  return typeof x === 'boolean' ? x : fallback;
}

function oneOf<T extends string>(x: unknown, allowed: readonly T[], fallback: T): T {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : fallback;
}

function str(x: unknown, fallback: string, max: number): string {
  return typeof x === 'string' ? x.slice(0, max) : fallback;
}

function sanitizeFill(raw: unknown, base: Fill): Fill {
  const f = isRecord(raw) ? raw : {};
  return {
    type: oneOf(f.type, FILL_TYPES, base.type),
    color1: color(f.color1, base.color1),
    color2: color(f.color2, base.color2),
    angle: num(f.angle, base.angle, RANGES.fillAngle),
  };
}

function sanitizeBorder(raw: unknown, base: Border): Border {
  const b = isRecord(raw) ? raw : {};
  return {
    width: num(b.width, base.width, RANGES.borderWidth),
    color: color(b.color, base.color),
  };
}

export function sanitizeTransform(raw: unknown): Transform {
  const t = isRecord(raw) ? raw : {};
  const d = DEFAULT_TRANSFORM;
  return {
    scale: num(t.scale, d.scale, RANGES.scale),
    x: num(t.x, d.x, RANGES.offset),
    y: num(t.y, d.y, RANGES.offset),
    rotation: num(t.rotation, d.rotation, RANGES.rotation),
    opacity: num(t.opacity, d.opacity, RANGES.opacity),
    flipX: bool(t.flipX, d.flipX),
    flipY: bool(t.flipY, d.flipY),
  };
}

export function sanitizeContent(raw: unknown): Content {
  if (!isRecord(raw)) return { kind: 'none' };
  switch (raw.kind) {
    case 'emoji': {
      const emoji = str(raw.emoji, '\u{1F451}', 32).trim();
      return { kind: 'emoji', emoji: emoji || '\u{1F451}', shadow: bool(raw.shadow, false) };
    }
    case 'text': {
      const stroke = isRecord(raw.stroke)
        ? {
            width: num(raw.stroke.width, 0.1, RANGES.strokeWidth),
            color: color(raw.stroke.color, '#000000'),
          }
        : null;
      const weight = (FONT_WEIGHTS as readonly number[]).includes(raw.weight as number)
        ? (raw.weight as FontWeight)
        : 900;
      return {
        kind: 'text',
        text: str(raw.text, 'A', 8),
        font: oneOf(raw.font, FONT_IDS, 'inter'),
        customFont:
          typeof raw.customFont === 'string' && isValidFontName(raw.customFont)
            ? raw.customFont.trim()
            : null,
        weight,
        color: color(raw.color, '#ffffff'),
        letterSpacing: num(raw.letterSpacing, 0, RANGES.letterSpacing),
        stroke,
        shadow: bool(raw.shadow, false),
      };
    }
    case 'symbol':
      return {
        kind: 'symbol',
        symbol: oneOf(raw.symbol, SYMBOL_IDS, 'crown'),
        color: color(raw.color, '#ffffff'),
        shadow: bool(raw.shadow, false),
      };
    case 'shape':
      return {
        kind: 'shape',
        shape: oneOf(raw.shape, SHAPES, 'circle'),
        sides: Math.round(num(raw.sides, 6, RANGES.sides)),
        innerRatio: num(raw.innerRatio, 0.62, RANGES.innerRatio),
        rotation: num(raw.rotation, 0, RANGES.shapeRotation),
        cornerRadius: num(raw.cornerRadius, 0.25, RANGES.cornerRadius),
        fill: sanitizeFill(raw.fill, {
          type: 'solid',
          color1: '#ffffff',
          color2: '#ffffff',
          angle: 135,
        }),
        border: sanitizeBorder(raw.border, { width: 0, color: '#000000' }),
        shadow: bool(raw.shadow, false),
      };
    case 'image':
      return {
        kind: 'image',
        src: typeof raw.src === 'string' && raw.src.startsWith('data:image/') ? raw.src : null,
        fit: oneOf(raw.fit, IMAGE_FITS, 'cover'),
      };
    case 'none':
      return { kind: 'none' };
    default:
      return { kind: 'none' };
  }
}

export function sanitizeBackground(raw: unknown): Background {
  const b = isRecord(raw) ? raw : {};
  const d = DEFAULT_BACKGROUND;
  const shadow = isRecord(b.shadow) ? b.shadow : {};
  return {
    shape: oneOf(b.shape, SHAPES, d.shape),
    cornerRadius: num(b.cornerRadius, d.cornerRadius, RANGES.cornerRadius),
    sides: Math.round(num(b.sides, d.sides, RANGES.sides)),
    innerRatio: num(b.innerRatio, d.innerRatio, RANGES.innerRatio),
    rotation: num(b.rotation, d.rotation, RANGES.shapeRotation),
    fill: sanitizeFill(b.fill, d.fill),
    border: sanitizeBorder(b.border, d.border),
    shadow: {
      enabled: bool(shadow.enabled, d.shadow.enabled),
      blur: num(shadow.blur, d.shadow.blur, RANGES.shadowBlur),
      opacity: num(shadow.opacity, d.shadow.opacity, RANGES.shadowOpacity),
      dx: num(shadow.dx, d.shadow.dx, RANGES.shadowOffset),
      dy: num(shadow.dy, d.shadow.dy, RANGES.shadowOffset),
      color: color(shadow.color, d.shadow.color),
    },
    gloss: bool(b.gloss, d.gloss),
  };
}

function sanitizeLayer(raw: unknown, index: number, usedIds: Set<string>): Layer {
  const l = isRecord(raw) ? raw : {};
  let id = str(l.id, '', 40).trim() || `l${index}`;
  while (usedIds.has(id)) id = `${id}_${index}`;
  usedIds.add(id);
  return {
    id,
    name: str(l.name, '', 40),
    hidden: bool(l.hidden, false),
    locked: bool(l.locked, false),
    content: sanitizeContent(l.content),
    transform: sanitizeTransform(l.transform),
    blend: oneOf(l.blend, BLEND_MODES, 'normal') as BlendMode,
    clip: bool(l.clip, true),
  };
}

/**
 * A v1 icon: one background shape and one content item. Its content becomes
 * the single layer of a v2 icon, so every old share link and saved design
 * reopens looking exactly the same.
 */
function migrateV1(raw: Record<string, unknown>): IconState {
  const background = sanitizeBackground({
    shape: raw.shape,
    cornerRadius: raw.cornerRadius,
    sides: raw.sides,
    innerRatio: raw.innerRatio,
    rotation: raw.shapeRotation,
    fill: raw.fill,
    border: raw.border,
    shadow: raw.shadow,
    gloss: raw.gloss,
  });
  const content = sanitizeContent(raw.content);
  if (content.kind === 'none') return { v: 2, background, layers: [] };
  const rawContent = isRecord(raw.content) ? raw.content : {};
  // v1 images carried their own "clip to shape" flag; every other kind was clipped.
  const clip = content.kind === 'image' ? bool(rawContent.clip, true) : true;
  return {
    v: 2,
    background,
    layers: [
      {
        id: 'l0',
        name: '',
        hidden: false,
        locked: false,
        content,
        transform: sanitizeTransform(raw.transform),
        blend: 'normal',
        clip,
      },
    ],
  };
}

/** Coerce anything (v1 states, hand-edited links, garbage) into a valid IconState. */
export function sanitizeIcon(raw: unknown): IconState {
  if (!isRecord(raw)) return structuredClone(DEFAULT_ICON);
  if (!Array.isArray(raw.layers)) return migrateV1(raw);
  const usedIds = new Set<string>();
  const layers = raw.layers
    .slice(0, MAX_LAYERS)
    .map((layer, index) => sanitizeLayer(layer, index, usedIds));
  return { v: 2, background: sanitizeBackground(raw.background), layers };
}

export function sanitizePreview(
  raw: unknown,
  base: PreviewSettings = DEFAULT_PREVIEW,
): PreviewSettings {
  if (!isRecord(raw)) return { ...base };
  return {
    username: str(raw.username, base.username, 32),
    roleName: str(raw.roleName, base.roleName, 100),
    roleColor: color(raw.roleColor, base.roleColor),
    message: str(raw.message, base.message, 200),
  };
}

/** Drop uploaded image data (too large for a URL). */
export function stripImages(icon: IconState): IconState {
  if (!icon.layers.some((l) => l.content.kind === 'image' && l.content.src)) return icon;
  return {
    ...icon,
    layers: icon.layers.map((layer) =>
      layer.content.kind === 'image' && layer.content.src
        ? { ...layer, content: { ...layer.content, src: null } }
        : layer,
    ),
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export interface ShareEnvelope {
  v: 2;
  icon: IconState;
  preview: Pick<PreviewSettings, 'username' | 'roleName' | 'roleColor'>;
}

export const SHARE_PARAM = 's';
/** Envelope versions this build can still open. */
const SUPPORTED_ENVELOPES = new Set([1, 2]);

export function encodeShare(icon: IconState, preview: PreviewSettings): string {
  const envelope: ShareEnvelope = {
    v: 2,
    icon: stripImages(icon),
    preview: {
      username: preview.username,
      roleName: preview.roleName,
      roleColor: preview.roleColor,
    },
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(envelope)));
}

export function decodeShare(encoded: string): { icon: IconState; preview: PreviewSettings } | null {
  try {
    const raw: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    if (!isRecord(raw) || typeof raw.v !== 'number' || !SUPPORTED_ENVELOPES.has(raw.v)) return null;
    return { icon: sanitizeIcon(raw.icon), preview: sanitizePreview(raw.preview) };
  } catch {
    return null;
  }
}

export function buildShareHash(encoded: string): string {
  return `#${SHARE_PARAM}=${encoded}`;
}

export function readShareHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const value = params.get(SHARE_PARAM);
  return value && value.length > 0 ? value : null;
}

/** The key is unchanged so designs saved by an earlier build are still found and migrated. */
export const STORAGE_KEY = 'role-icon-maker:v1';

export interface PersistedState {
  v: 2;
  icon: IconState;
  preview: PreviewSettings;
}

export function serializePersisted(icon: IconState, preview: PreviewSettings): string {
  const state: PersistedState = { v: 2, icon, preview };
  return JSON.stringify(state);
}

export function parsePersisted(json: string | null): PersistedState | null {
  if (!json) return null;
  try {
    const raw: unknown = JSON.parse(json);
    if (!isRecord(raw) || typeof raw.v !== 'number' || !SUPPORTED_ENVELOPES.has(raw.v)) return null;
    return { v: 2, icon: sanitizeIcon(raw.icon), preview: sanitizePreview(raw.preview) };
  } catch {
    return null;
  }
}
