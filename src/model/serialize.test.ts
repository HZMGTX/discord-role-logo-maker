import { describe, expect, it } from 'vitest';
import { DEFAULT_ICON, DEFAULT_PREVIEW } from './defaults';
import { PRESETS } from './presets';
import {
  buildShareHash,
  decodeShare,
  encodeShare,
  parsePersisted,
  readShareHash,
  sanitizeIcon,
  serializePersisted,
  stripImages,
} from './serialize';
import { MAX_FILL_STOPS, MAX_LAYERS, RANGES, type IconState } from './types';

/** An icon exactly as the previous version of the app wrote it. */
const V1_ICON = {
  v: 1,
  shape: 'shield',
  cornerRadius: 0.3,
  fill: { type: 'linear', color1: '#ff5f5f', color2: '#b3121b', angle: 160 },
  border: { width: 0.04, color: '#ffffff' },
  shadow: { enabled: true, blur: 0.04, opacity: 0.35, dx: 0, dy: 0.02, color: '#000000' },
  gloss: true,
  content: { kind: 'symbol', symbol: 'crown', color: '#ffffff', shadow: false },
  transform: { scale: 1.1, x: 0, y: -0.05, rotation: 0, opacity: 1 },
};

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('share links', () => {
  it('round-trips every preset', () => {
    for (const preset of PRESETS) {
      const preview = { ...DEFAULT_PREVIEW, roleName: preset.name, roleColor: preset.roleColor };
      const decoded = decodeShare(encodeShare(preset.icon, preview));
      expect(decoded).not.toBeNull();
      expect(decoded?.icon).toEqual(preset.icon);
      expect(decoded?.preview.roleName).toBe(preset.name);
      expect(decoded?.preview.roleColor).toBe(preset.roleColor);
    }
  });

  it('is URL safe', () => {
    expect(encodeShare(DEFAULT_ICON, DEFAULT_PREVIEW)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects garbage and unknown versions', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('not base64 at all!!')).toBeNull();
    expect(decodeShare(btoa('{"v":9}'))).toBeNull();
    expect(decodeShare(btoa('[]'))).toBeNull();
  });

  it('still opens a link written by the previous version', () => {
    const legacy = toBase64Url(
      JSON.stringify({
        v: 1,
        icon: V1_ICON,
        preview: { username: 'Ayla', roleName: 'Admin', roleColor: '#e74c3c' },
      }),
    );
    const decoded = decodeShare(legacy);
    expect(decoded).not.toBeNull();
    const icon = decoded!.icon;
    expect(icon.v).toBe(2);
    expect(icon.background.shape).toBe('shield');
    expect(icon.background.fill.color1).toBe('#ff5f5f');
    expect(icon.background.gloss).toBe(true);
    expect(icon.background.shadow.enabled).toBe(true);
    expect(icon.layers).toHaveLength(1);
    expect(icon.layers[0]?.content).toEqual({
      kind: 'symbol',
      symbol: 'crown',
      color: '#ffffff',
      shadow: false,
    });
    expect(icon.layers[0]?.transform).toMatchObject({ scale: 1.1, y: -0.05 });
    expect(icon.layers[0]?.clip).toBe(true);
    expect(decoded!.preview.roleName).toBe('Admin');
  });

  it('strips uploaded image data from every layer', () => {
    const icon: IconState = {
      ...DEFAULT_ICON,
      layers: [
        { ...DEFAULT_ICON.layers[0]!, id: 'a' },
        {
          ...DEFAULT_ICON.layers[0]!,
          id: 'b',
          content: { kind: 'image', src: 'data:image/png;base64,AAAA', fit: 'contain' },
        },
      ],
    };
    const stripped = stripImages(icon);
    expect(stripped.layers[1]?.content).toEqual({ kind: 'image', src: null, fit: 'contain' });
    expect(stripped.layers[0]).toEqual(icon.layers[0]);
    const decoded = decodeShare(encodeShare(icon, DEFAULT_PREVIEW));
    expect(decoded?.icon.layers[1]?.content).toEqual({ kind: 'image', src: null, fit: 'contain' });
    expect(stripImages(DEFAULT_ICON)).toBe(DEFAULT_ICON);
  });

  it('reads and writes the URL hash', () => {
    expect(readShareHash(buildShareHash('abc-_'))).toBe('abc-_');
    expect(readShareHash('#')).toBeNull();
    expect(readShareHash('')).toBeNull();
    expect(readShareHash('#other=1')).toBeNull();
  });
});

describe('migrating a v1 icon', () => {
  it('keeps an unclipped image unclipped', () => {
    const icon = sanitizeIcon({
      ...V1_ICON,
      content: { kind: 'image', src: 'data:image/png;base64,AAAA', fit: 'cover', clip: false },
    });
    expect(icon.layers[0]?.clip).toBe(false);
    expect(icon.layers[0]?.content).toEqual({
      kind: 'image',
      src: 'data:image/png;base64,AAAA',
      fit: 'cover',
    });
  });

  it('gives the migrated layer no effects and no mask', () => {
    const icon = sanitizeIcon(V1_ICON);
    expect(icon.layers[0]?.effects).toEqual({ glow: null, tint: null, outline: null });
    expect(icon.layers[0]?.clipTo).toBeNull();
    expect(icon.layers[0]?.blend).toBe('normal');
    expect(icon.background.fill.stops).toEqual([]);
  });

  it('turns empty content into a bare plate', () => {
    const icon = sanitizeIcon({ ...V1_ICON, content: { kind: 'none' } });
    expect(icon.layers).toEqual([]);
    expect(icon.background.shape).toBe('shield');
  });
});

describe('sanitizeIcon', () => {
  it('clamps numbers and falls back on bad enums', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: {
        shape: 'blob',
        cornerRadius: 9,
        fill: { type: 'linear', color1: 'red', angle: -50 },
      },
      layers: [
        {
          id: 'x',
          content: { kind: 'symbol', symbol: 'nope' },
          transform: { scale: 100, rotation: 'sideways' },
          blend: 'teleport',
        },
      ],
    });
    expect(icon.background.shape).toBe(DEFAULT_ICON.background.shape);
    expect(icon.background.cornerRadius).toBe(0.5);
    expect(icon.background.fill.color1).toBe(DEFAULT_ICON.background.fill.color1);
    expect(icon.background.fill.angle).toBe(0);
    expect(icon.layers[0]?.transform.scale).toBe(3);
    expect(icon.layers[0]?.transform.rotation).toBe(0);
    expect(icon.layers[0]?.blend).toBe('normal');
    expect(icon.layers[0]?.content).toEqual({
      kind: 'symbol',
      symbol: 'crown',
      color: '#ffffff',
      shadow: false,
    });
  });

  it('clamps the shape controls and rounds the side count', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: { shape: 'burst', sides: 99.7, innerRatio: -3, rotation: 900 },
      layers: [],
    });
    expect(icon.background.shape).toBe('burst');
    expect(icon.background.sides).toBe(24);
    expect(icon.background.innerRatio).toBe(0.2);
    expect(icon.background.rotation).toBe(180);
  });

  it('gives every layer a unique id and caps the stack', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: {},
      layers: Array.from({ length: MAX_LAYERS + 5 }, () => ({
        id: 'same',
        content: { kind: 'emoji', emoji: '⭐' },
      })),
    });
    expect(icon.layers).toHaveLength(MAX_LAYERS);
    expect(new Set(icon.layers.map((l) => l.id)).size).toBe(MAX_LAYERS);
  });

  it('only accepts a plain font family name', () => {
    const text = (customFont: unknown) => ({
      v: 2,
      background: {},
      layers: [{ content: { kind: 'text', text: 'A', customFont } }],
    });
    expect(sanitizeIcon(text('Comic Neue')).layers[0]?.content).toMatchObject({
      customFont: 'Comic Neue',
    });
    for (const bad of ['a"; }', 'x'.repeat(60), '', '  ', 42, null]) {
      expect(sanitizeIcon(text(bad)).layers[0]?.content).toMatchObject({ customFont: null });
    }
  });

  it('reads a fill written before gradients had stops', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: { fill: { type: 'linear', color1: '#ff0000', color2: '#0000ff', angle: 90 } },
      layers: [],
    });
    expect(icon.background.fill).toEqual({
      type: 'linear',
      color1: '#ff0000',
      color2: '#0000ff',
      angle: 90,
      stops: [],
      cx: 0,
      cy: 0,
      radius: 0.55,
    });
  });

  it('sorts, clamps and caps gradient stops', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: {
        fill: {
          type: 'conic',
          color1: '#000000',
          color2: '#ffffff',
          cx: -9,
          radius: 99,
          stops: [
            { offset: 0.9, color: '#111111' },
            { offset: -4, color: '#222222' },
            { offset: 0.4, color: 'not a color' },
            ...Array.from({ length: MAX_FILL_STOPS }, () => ({ offset: 0.5, color: '#333333' })),
          ],
        },
      },
      layers: [],
    });
    const { fill } = icon.background;
    expect(fill.type).toBe('conic');
    expect(fill.stops).toHaveLength(MAX_FILL_STOPS);
    expect(fill.stops.map((s) => s.offset)).toEqual([...fill.stops.map((s) => s.offset)].sort((a, b) => a - b));
    expect(fill.stops[0]).toEqual({ offset: 0, color: '#222222' });
    expect(fill.stops.some((s) => s.color === '#ffffff')).toBe(true);
    expect(fill.cx).toBe(-0.5);
    expect(fill.radius).toBe(1.5);
  });

  it('drops a mask that points at nothing or at itself', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: {},
      layers: [
        { id: 'a', content: { kind: 'emoji', emoji: '⭐' }, clipTo: 'a' },
        { id: 'b', content: { kind: 'emoji', emoji: '⭐' }, clipTo: 'ghost' },
        { id: 'c', content: { kind: 'emoji', emoji: '⭐' }, clipTo: 'a' },
      ],
    });
    expect(icon.layers[0]?.clipTo).toBeNull();
    expect(icon.layers[1]?.clipTo).toBeNull();
    expect(icon.layers[2]?.clipTo).toBe('a');
  });

  it('keeps a mask pointing at the layer that kept the id after a rewrite', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: {},
      layers: [
        { id: 'dup', content: { kind: 'symbol', symbol: 'gem' } },
        { id: 'dup', content: { kind: 'symbol', symbol: 'key' } },
        { id: 'x', content: { kind: 'emoji', emoji: '⭐' }, clipTo: 'dup' },
      ],
    });
    const ids = icon.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(3);
    expect(icon.layers[2]?.clipTo).toBe(ids[0]);
  });

  it('keeps two layers masked to each other', () => {
    // Masking is one level deep: a mask contributes only its shape, so a pair
    // pointing at each other is a legal intersection, not a loop to break.
    const icon = sanitizeIcon({
      v: 2,
      background: {},
      layers: [
        { id: 'a', content: { kind: 'symbol', symbol: 'gem' }, clipTo: 'b' },
        { id: 'b', content: { kind: 'symbol', symbol: 'star' }, clipTo: 'a' },
      ],
    });
    expect(icon.layers[0]?.clipTo).toBe('b');
    expect(icon.layers[1]?.clipTo).toBe('a');
  });

  it('clamps effects and drops malformed ones', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: {},
      layers: [
        {
          id: 'a',
          content: { kind: 'emoji', emoji: '⭐' },
          blend: 'erase',
          effects: {
            glow: { color: '#00ff00', blur: 99, opacity: -1 },
            outline: 'yes please',
            tint: { color: 'nope', amount: 0.5 },
          },
        },
      ],
    });
    const layer = icon.layers[0];
    expect(layer?.blend).toBe('erase');
    expect(layer?.effects.glow).toEqual({
      color: '#00ff00',
      blur: RANGES.glowBlur.max,
      opacity: RANGES.glowOpacity.min,
    });
    expect(layer?.effects.outline).toBeNull();
    expect(layer?.effects.tint).toEqual({ color: '#ffffff', amount: 0.5 });
  });

  it('gives a design saved before effects existed no effects and no mask', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: {},
      layers: [{ id: 'a', content: { kind: 'emoji', emoji: '⭐' } }],
    });
    expect(icon.layers[0]?.effects).toEqual({ glow: null, tint: null, outline: null });
    expect(icon.layers[0]?.clipTo).toBeNull();
  });

  it('returns the defaults for non-objects', () => {
    expect(sanitizeIcon(null)).toEqual(DEFAULT_ICON);
    expect(sanitizeIcon('x')).toEqual(DEFAULT_ICON);
    expect(sanitizeIcon([1, 2])).toEqual(DEFAULT_ICON);
  });

  it('keeps valid input untouched', () => {
    for (const preset of PRESETS) {
      expect(sanitizeIcon(JSON.parse(JSON.stringify(preset.icon)))).toEqual(preset.icon);
    }
  });
});

describe('persisted state', () => {
  it('round-trips', () => {
    const parsed = parsePersisted(serializePersisted(DEFAULT_ICON, DEFAULT_PREVIEW));
    expect(parsed?.icon).toEqual(DEFAULT_ICON);
    expect(parsed?.preview).toEqual(DEFAULT_PREVIEW);
  });

  it('migrates a design saved by the previous version', () => {
    const legacy = JSON.stringify({ v: 1, icon: V1_ICON, preview: DEFAULT_PREVIEW });
    const parsed = parsePersisted(legacy);
    expect(parsed?.icon.v).toBe(2);
    expect(parsed?.icon.background.shape).toBe('shield');
    expect(parsed?.icon.layers).toHaveLength(1);
  });

  it('returns null for missing or invalid data', () => {
    expect(parsePersisted(null)).toBeNull();
    expect(parsePersisted('{')).toBeNull();
    expect(parsePersisted('{"v":0}')).toBeNull();
  });
});
