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

describe('model icon conversion', () => {
  it('round-trips the default icon', () => {
    expect(toIconState(toModelIcon(DEFAULT_ICON))).toEqual(DEFAULT_ICON);
  });

  it('cleans up sloppy model output', () => {
    const icon = toIconState({
      shape: 'badge',
      cornerRadius: 9,
      fillType: 'linear',
      color1: 'red',
      color2: '#ABCDEF',
      angle: 720,
      borderWidth: 5,
      borderColor: 'nope',
      shadow: true,
      gloss: false,
      contentKind: 'emoji',
      emoji: 'a frog 🐸 please',
      text: '',
      font: 'inter',
      customFont: '',
      symbol: 'star',
      contentColor: '#ffffff',
      contentShadow: false,
      scale: 40,
    });
    expect(icon.shape).toBe('badge');
    expect(icon.cornerRadius).toBe(0.5);
    expect(icon.fill.color1).toBe(DEFAULT_ICON.fill.color1);
    expect(icon.fill.color2).toBe('#abcdef');
    expect(icon.fill.angle).toBe(360);
    expect(icon.border).toEqual({ width: 0.12, color: '#ffffff' });
    expect(icon.content).toEqual({ kind: 'emoji', emoji: '🐸', shadow: false });
    expect(icon.transform.scale).toBe(1.5);
    expect(sanitizeIcon(JSON.parse(JSON.stringify(icon)))).toEqual(icon);
  });

  it('accepts a named Google Font and rejects an unsafe one', () => {
    const good = toIconState({
      ...toModelIcon(DEFAULT_ICON),
      contentKind: 'text',
      text: 'GG',
      customFont: 'Rampart One',
    });
    expect(good.content).toMatchObject({ kind: 'text', customFont: 'Rampart One' });
    const bad = toIconState({
      ...toModelIcon(DEFAULT_ICON),
      contentKind: 'text',
      text: 'GG',
      customFont: 'Evil"; background: url(x)',
    });
    expect(bad.content).toMatchObject({ kind: 'text', customFont: null });
  });

  it('maps text and symbol content', () => {
    const text = toIconState({
      ...toModelIcon(DEFAULT_ICON),
      contentKind: 'text',
      text: 'moderators',
      font: 'bangers',
      contentColor: '#111111',
    });
    expect(text.content).toMatchObject({ kind: 'text', text: 'moderato', font: 'bangers', color: '#111111' });
    const symbol = toIconState({ ...toModelIcon(DEFAULT_ICON), contentKind: 'symbol', symbol: 'gear' });
    expect(symbol.content).toMatchObject({ kind: 'symbol', symbol: 'gear' });
  });
});
