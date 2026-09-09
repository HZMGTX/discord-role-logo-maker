import { DEFAULT_ICON, DEFAULT_PREVIEW } from './defaults';
import {
  FILL_TYPES,
  FONTS,
  FONT_WEIGHTS,
  IMAGE_FITS,
  RANGES,
  SHAPES,
  SYMBOL_IDS,
  isValidFontName,
  type Content,
  type FontId,
  type FontWeight,
  type IconState,
  type PreviewSettings,
  type Range,
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

export function sanitizeContent(raw: unknown): Content {
  if (!isRecord(raw)) return structuredClone(DEFAULT_ICON.content);
  switch (raw.kind) {
    case 'emoji': {
      const emoji = str(raw.emoji, '👑', 32).trim();
      return { kind: 'emoji', emoji: emoji || '👑', shadow: bool(raw.shadow, false) };
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
    case 'image':
      return {
        kind: 'image',
        src: typeof raw.src === 'string' && raw.src.startsWith('data:image/') ? raw.src : null,
        fit: oneOf(raw.fit, IMAGE_FITS, 'cover'),
        clip: bool(raw.clip, true),
      };
    case 'none':
      return { kind: 'none' };
    default:
      return structuredClone(DEFAULT_ICON.content);
  }
}

/** Coerce anything (old versions, hand-edited links, garbage) into a valid IconState. */
export function sanitizeIcon(raw: unknown): IconState {
  const d = DEFAULT_ICON;
  if (!isRecord(raw)) return structuredClone(d);
  const fill = isRecord(raw.fill) ? raw.fill : {};
  const border = isRecord(raw.border) ? raw.border : {};
  const shadow = isRecord(raw.shadow) ? raw.shadow : {};
  const t = isRecord(raw.transform) ? raw.transform : {};
  return {
    v: 1,
    shape: oneOf(raw.shape, SHAPES, d.shape),
    cornerRadius: num(raw.cornerRadius, d.cornerRadius, RANGES.cornerRadius),
    sides: Math.round(num(raw.sides, d.sides, RANGES.sides)),
    innerRatio: num(raw.innerRatio, d.innerRatio, RANGES.innerRatio),
    shapeRotation: num(raw.shapeRotation, d.shapeRotation, RANGES.shapeRotation),
    fill: {
      type: oneOf(fill.type, FILL_TYPES, d.fill.type),
      color1: color(fill.color1, d.fill.color1),
      color2: color(fill.color2, d.fill.color2),
      angle: num(fill.angle, d.fill.angle, RANGES.fillAngle),
    },
    border: {
      width: num(border.width, d.border.width, RANGES.borderWidth),
      color: color(border.color, d.border.color),
    },
    shadow: {
      enabled: bool(shadow.enabled, d.shadow.enabled),
      blur: num(shadow.blur, d.shadow.blur, RANGES.shadowBlur),
      opacity: num(shadow.opacity, d.shadow.opacity, RANGES.shadowOpacity),
      dx: num(shadow.dx, d.shadow.dx, RANGES.shadowOffset),
      dy: num(shadow.dy, d.shadow.dy, RANGES.shadowOffset),
      color: color(shadow.color, d.shadow.color),
    },
    gloss: bool(raw.gloss, d.gloss),
    content: sanitizeContent(raw.content),
    transform: {
      scale: num(t.scale, d.transform.scale, RANGES.scale),
      x: num(t.x, d.transform.x, RANGES.offset),
      y: num(t.y, d.transform.y, RANGES.offset),
      rotation: num(t.rotation, d.transform.rotation, RANGES.rotation),
      opacity: num(t.opacity, d.transform.opacity, RANGES.opacity),
    },
  };
}

export function sanitizePreview(raw: unknown, base: PreviewSettings = DEFAULT_PREVIEW): PreviewSettings {
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
  if (icon.content.kind === 'image' && icon.content.src) {
    return { ...icon, content: { ...icon.content, src: null } };
  }
  return icon;
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
  v: 1;
  icon: IconState;
  preview: Pick<PreviewSettings, 'username' | 'roleName' | 'roleColor'>;
}

export const SHARE_PARAM = 's';

export function encodeShare(icon: IconState, preview: PreviewSettings): string {
  const envelope: ShareEnvelope = {
    v: 1,
    icon: stripImages(icon),
    preview: {
      username: preview.username,
      roleName: preview.roleName,
      roleColor: preview.roleColor,
    },
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(envelope)));
}

export function decodeShare(
  encoded: string,
): { icon: IconState; preview: PreviewSettings } | null {
  try {
    const raw: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    if (!isRecord(raw) || raw.v !== 1) return null;
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

export const STORAGE_KEY = 'role-icon-maker:v1';

export interface PersistedState {
  v: 1;
  icon: IconState;
  preview: PreviewSettings;
}

export function serializePersisted(icon: IconState, preview: PreviewSettings): string {
  const state: PersistedState = { v: 1, icon, preview };
  return JSON.stringify(state);
}

export function parsePersisted(json: string | null): PersistedState | null {
  if (!json) return null;
  try {
    const raw: unknown = JSON.parse(json);
    if (!isRecord(raw) || raw.v !== 1) return null;
    return { v: 1, icon: sanitizeIcon(raw.icon), preview: sanitizePreview(raw.preview) };
  } catch {
    return null;
  }
}
