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
import type { IconState } from './types';

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
    expect(decodeShare(btoa('{"v":2}'))).toBeNull();
    expect(decodeShare(btoa('[]'))).toBeNull();
  });

  it('strips uploaded image data', () => {
    const icon: IconState = {
      ...DEFAULT_ICON,
      content: { kind: 'image', src: 'data:image/png;base64,AAAA', fit: 'contain', clip: false },
    };
    const stripped = stripImages(icon);
    expect(stripped.content).toEqual({ kind: 'image', src: null, fit: 'contain', clip: false });
    const decoded = decodeShare(encodeShare(icon, DEFAULT_PREVIEW));
    expect(decoded?.icon.content).toEqual(stripped.content);
    expect(stripImages(DEFAULT_ICON)).toBe(DEFAULT_ICON);
  });

  it('reads and writes the URL hash', () => {
    expect(readShareHash(buildShareHash('abc-_'))).toBe('abc-_');
    expect(readShareHash('#')).toBeNull();
    expect(readShareHash('')).toBeNull();
    expect(readShareHash('#other=1')).toBeNull();
  });
});

describe('sanitizeIcon', () => {
  it('clamps numbers and falls back on bad enums', () => {
    const icon = sanitizeIcon({
      shape: 'blob',
      cornerRadius: 9,
      fill: { type: 'linear', color1: 'red', angle: -50 },
      transform: { scale: 100, rotation: 'sideways' },
      content: { kind: 'symbol', symbol: 'nope' },
    });
    expect(icon.shape).toBe(DEFAULT_ICON.shape);
    expect(icon.cornerRadius).toBe(0.5);
    expect(icon.fill.color1).toBe(DEFAULT_ICON.fill.color1);
    expect(icon.fill.angle).toBe(0);
    expect(icon.transform.scale).toBe(1.5);
    expect(icon.transform.rotation).toBe(0);
    expect(icon.content).toEqual({ kind: 'symbol', symbol: 'crown', color: '#ffffff', shadow: false });
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

  it('returns null for missing or invalid data', () => {
    expect(parsePersisted(null)).toBeNull();
    expect(parsePersisted('{')).toBeNull();
    expect(parsePersisted('{"v":0}')).toBeNull();
  });
});
