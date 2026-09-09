import { describe, expect, it } from 'vitest';
import { DEFAULT_ICON } from '../model/defaults';
import { sanitizeIcon } from '../model/serialize';
import {
  RATE_LIMIT,
  assistantStatus,
  checkRateLimit,
  handleAssistantRequest,
  toIconState,
  toModelIcon,
} from './assistant';

describe('assistantStatus', () => {
  it('is off without a key and reports the model', () => {
    expect(assistantStatus({})).toEqual({ enabled: false, model: 'claude-opus-5' });
    expect(assistantStatus({ ANTHROPIC_API_KEY: 'k', ASSISTANT_MODEL: 'claude-haiku-4-5' })).toEqual({
      enabled: true,
      model: 'claude-haiku-4-5',
    });
  });
});

describe('handleAssistantRequest', () => {
  it('rejects bad payloads before doing anything else', async () => {
    expect((await handleAssistantRequest({}, { ip: 'a', env: {} })).status).toBe(400);
    expect((await handleAssistantRequest({ mode: 'ideas', prompt: '' }, { ip: 'a', env: {} })).status).toBe(400);
    expect(
      (await handleAssistantRequest({ mode: 'ideas', prompt: 'x'.repeat(401) }, { ip: 'a', env: {} })).status,
    ).toBe(400);
  });

  it('reports smart mode as not configured without a key', async () => {
    const result = await handleAssistantRequest({ mode: 'ideas', prompt: 'a crown' }, { ip: 'a', env: {} });
    expect(result.status).toBe(503);
    expect(result.body.error).toBe('not_configured');
  });
});

describe('checkRateLimit', () => {
  it('allows a burst up to the limit, then blocks until the window passes', () => {
    const now = 1_000_000;
    for (let i = 0; i < RATE_LIMIT.max; i++) expect(checkRateLimit('ip-test', now + i)).toBe(true);
    expect(checkRateLimit('ip-test', now + RATE_LIMIT.max)).toBe(false);
    expect(checkRateLimit('ip-test', now + RATE_LIMIT.windowMs + RATE_LIMIT.max + 1)).toBe(true);
    expect(checkRateLimit('someone-else', now)).toBe(true);
  });
});

/** A layer as the model would describe it, with every field filled in. */
function modelLayer(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'emoji' as const,
    emoji: '⭐',
    text: '',
    font: 'inter' as const,
    customFont: '',
    symbol: 'star' as const,
    color: '#ffffff',
    color2: '#ffffff',
    gradient: false,
    shape: 'circle' as const,
    sides: 6,
    scale: 1,
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    shadow: false,
    clip: true,
    glowColor: '',
    outlineColor: '',
    tintColor: '',
    ...overrides,
  };
}

describe('model icon conversion', () => {
  it('round-trips the default icon', () => {
    expect(toIconState(toModelIcon(DEFAULT_ICON))).toEqual({
      ...DEFAULT_ICON,
      layers: DEFAULT_ICON.layers.map((l, i) => ({ ...l, id: `m${i}` })),
    });
  });

  it('round-trips a stacked design', () => {
    const stacked = sanitizeIcon({
      v: 2,
      background: { shape: 'hexagon', fill: { type: 'linear', color1: '#112233', color2: '#445566', angle: 90 } },
      layers: [
        {
          id: 'a',
          content: {
            kind: 'shape',
            shape: 'burst',
            sides: 10,
            fill: { type: 'linear', color1: '#ff0000', color2: '#00ff00', angle: 135 },
          },
          transform: { scale: 1.2, opacity: 0.4 },
        },
        { id: 'b', content: { kind: 'symbol', symbol: 'trophy', color: '#f1c40f' } },
      ],
    });
    const back = toIconState(toModelIcon(stacked));
    expect(back.layers).toHaveLength(2);
    expect(back.background.shape).toBe('hexagon');
    expect(back.layers[0]?.content).toMatchObject({ kind: 'shape', shape: 'burst', sides: 10 });
    expect(back.layers[0]?.transform).toMatchObject({ scale: 1.2, opacity: 0.4 });
    expect(back.layers[1]?.content).toMatchObject({ kind: 'symbol', symbol: 'trophy', color: '#f1c40f' });
  });

  it('carries layer effects and a third gradient color both ways', () => {
    const icon = toIconState({
      shape: 'circle',
      cornerRadius: 0.25,
      sides: 6,
      innerRatio: 0.62,
      shapeRotation: 0,
      fillType: 'linear',
      color1: '#ff0000',
      color2: '#0000ff',
      color3: '#00FF00',
      angle: 135,
      borderWidth: 0,
      borderColor: '#ffffff',
      shadow: false,
      gloss: false,
      layers: [modelLayer({ glowColor: '#FFAA00', outlineColor: 'not a color', tintColor: '#123456' })],
    });
    expect(icon.background.fill.stops).toEqual([{ offset: 0.5, color: '#00ff00' }]);
    expect(icon.layers[0]?.effects.glow).toMatchObject({ color: '#ffaa00' });
    expect(icon.layers[0]?.effects.outline).toBeNull();
    expect(icon.layers[0]?.effects.tint).toMatchObject({ color: '#123456' });

    const back = toModelIcon(icon);
    expect(back.color3).toBe('#00ff00');
    expect(back.layers[0]?.glowColor).toBe('#ffaa00');
    expect(back.layers[0]?.outlineColor).toBe('');
    expect(back.layers[0]?.tintColor).toBe('#123456');
  });

  it('keeps gradient detail the flat schema cannot describe', () => {
    const tuned = {
      ...DEFAULT_ICON,
      background: {
        ...DEFAULT_ICON.background,
        fill: {
          ...DEFAULT_ICON.background.fill,
          type: 'radial' as const,
          cx: 0.2,
          cy: -0.15,
          radius: 0.9,
          stops: [{ offset: 0.35, color: '#00ff00' }],
        },
      },
    };
    // A tweak that says nothing about the fill must not flatten it.
    const tweaked = toIconState({ ...toModelIcon(tuned), gloss: true }, tuned);
    expect(tweaked.background.fill).toMatchObject({
      cx: 0.2,
      cy: -0.15,
      radius: 0.9,
      stops: [{ offset: 0.35, color: '#00ff00' }],
    });
    expect(tweaked.background.gloss).toBe(true);

    // The model can still change the middle color, keeping where it sits.
    const recolored = toIconState({ ...toModelIcon(tuned), color3: '#ff00ff' }, tuned);
    expect(recolored.background.fill.stops).toEqual([{ offset: 0.35, color: '#ff00ff' }]);

    // And it can drop the middle color by clearing it.
    const plain = toIconState({ ...toModelIcon(tuned), color3: '' }, tuned);
    expect(plain.background.fill.stops).toEqual([]);
  });

  it('keeps the blend, the mask and the effect strengths a tweak cannot describe', () => {
    const tuned = sanitizeIcon({
      v: 2,
      background: {},
      layers: [
        { id: 'mask', content: { kind: 'symbol', symbol: 'star' } },
        {
          id: 'art',
          content: { kind: 'symbol', symbol: 'gem', color: '#ffffff' },
          blend: 'multiply',
          clipTo: 'mask',
          effects: {
            glow: { color: '#00ff00', blur: 0.19, opacity: 0.15 },
            outline: { width: 0.1, color: '#123456' },
            tint: null,
          },
        },
      ],
    });
    const back = toIconState(toModelIcon(tuned), tuned);
    const art = back.layers[1];
    expect(art?.blend).toBe('multiply');
    expect(art?.clipTo).toBe(back.layers[0]?.id);
    // The colors come from the model; the strengths come from the design.
    expect(art?.effects.glow).toEqual({ color: '#00ff00', blur: 0.19, opacity: 0.15 });
    expect(art?.effects.outline).toEqual({ width: 0.1, color: '#123456' });
    // Clearing the color still turns the effect off.
    const model = toModelIcon(tuned);
    const layer = model.layers[1];
    if (layer) layer.glowColor = '';
    expect(toIconState(model, tuned).layers[1]?.effects.glow).toBeNull();
  });

  it('cleans up sloppy model output', () => {
    const icon = toIconState({
      shape: 'badge',
      cornerRadius: 9,
      sides: 99,
      innerRatio: -3,
      shapeRotation: 900,
      fillType: 'linear',
      color1: 'red',
      color2: '#ABCDEF',
      color3: '',
      angle: 720,
      borderWidth: 5,
      borderColor: 'nope',
      shadow: true,
      gloss: false,
      layers: [modelLayer({ emoji: 'a frog 🐸 please', scale: 40 })],
    });
    expect(icon.background.shape).toBe('badge');
    expect(icon.background.cornerRadius).toBe(0.5);
    expect(icon.background.sides).toBe(24);
    expect(icon.background.innerRatio).toBe(0.2);
    expect(icon.background.rotation).toBe(180);
    expect(icon.background.fill.color1).toBe(DEFAULT_ICON.background.fill.color1);
    expect(icon.background.fill.color2).toBe('#abcdef');
    expect(icon.background.fill.angle).toBe(360);
    expect(icon.background.border).toEqual({ width: 0.12, color: '#ffffff' });
    expect(icon.layers[0]?.content).toEqual({ kind: 'emoji', emoji: '🐸', shadow: false });
    expect(icon.layers[0]?.transform.scale).toBe(3);
    expect(sanitizeIcon(JSON.parse(JSON.stringify(icon)))).toEqual(icon);
  });

  it('keeps an uploaded image through a tweak the model cannot carry', () => {
    const withImage = sanitizeIcon({
      v: 2,
      background: {},
      layers: [
        { id: 'pic', content: { kind: 'image', src: 'data:image/png;base64,AAAA', fit: 'cover' } },
        { id: 'mark', content: { kind: 'symbol', symbol: 'crown', color: '#ffffff' } },
      ],
    });
    // The model sees the picture as an image layer and hands it straight back.
    const asModel = toModelIcon(withImage);
    expect(asModel.layers[0]?.kind).toBe('image');
    const back = toIconState(asModel, withImage);
    expect(back.layers[0]?.content).toEqual({
      kind: 'image',
      src: 'data:image/png;base64,AAAA',
      fit: 'cover',
    });
    expect(back.layers[1]?.content).toMatchObject({ kind: 'symbol', symbol: 'crown' });
    // Without the previous icon there are no bytes to restore, so it drops out.
    expect(toIconState(asModel).layers).toHaveLength(1);
  });

  it('drops empty layers and keeps the plate', () => {
    const icon = toIconState({
      ...toModelIcon(DEFAULT_ICON),
      layers: [modelLayer({ kind: 'none' }), modelLayer({ kind: 'symbol', symbol: 'gem' })],
    });
    expect(icon.layers).toHaveLength(1);
    expect(icon.layers[0]?.content).toMatchObject({ kind: 'symbol', symbol: 'gem' });
  });

  it('accepts a named Google Font and rejects an unsafe one', () => {
    const withFont = (customFont: string) =>
      toIconState({
        ...toModelIcon(DEFAULT_ICON),
        layers: [modelLayer({ kind: 'text', text: 'GG', customFont })],
      }).layers[0]?.content;
    expect(withFont('Rampart One')).toMatchObject({ kind: 'text', customFont: 'Rampart One' });
    expect(withFont('Evil"; background: url(x)')).toMatchObject({ kind: 'text', customFont: null });
  });

  it('maps text and shape content', () => {
    const text = toIconState({
      ...toModelIcon(DEFAULT_ICON),
      layers: [modelLayer({ kind: 'text', text: 'moderators', font: 'bangers', color: '#111111' })],
    });
    expect(text.layers[0]?.content).toMatchObject({
      kind: 'text',
      text: 'moderato',
      font: 'bangers',
      color: '#111111',
    });
    const shape = toIconState({
      ...toModelIcon(DEFAULT_ICON),
      layers: [modelLayer({ kind: 'shape', shape: 'polygon', sides: 5, gradient: true, color: '#ff0000', color2: '#0000ff' })],
    });
    expect(shape.layers[0]?.content).toMatchObject({
      kind: 'shape',
      shape: 'polygon',
      sides: 5,
      fill: { type: 'linear', color1: '#ff0000', color2: '#0000ff' },
    });
  });
});
