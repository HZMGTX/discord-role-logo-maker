import { describe, expect, it } from 'vitest';
import { firstEmoji, twemojiFile, twemojiUrl } from './twemoji';

describe('twemojiFile', () => {
  it('maps a single code point', () => {
    expect(twemojiFile('👑')).toBe('1f451');
  });

  it('drops the variation selector when there is no ZWJ', () => {
    expect(twemojiFile('❤️')).toBe('2764');
    expect(twemojiFile('☠️')).toBe('2620');
  });

  it('keeps keycap sequences', () => {
    expect(twemojiFile('1️⃣')).toBe('31-20e3');
  });

  it('keeps the variation selector inside ZWJ sequences', () => {
    expect(twemojiFile('🏳️‍🌈')).toBe('1f3f3-fe0f-200d-1f308');
    expect(twemojiFile('🏴‍☠️')).toBe('1f3f4-200d-2620-fe0f');
  });

  it('joins flag code points', () => {
    expect(twemojiFile('🇻🇳')).toBe('1f1fb-1f1f3');
  });
});

describe('twemojiUrl', () => {
  it('builds a jsDelivr SVG URL', () => {
    expect(twemojiUrl('👑')).toBe(
      'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/1f451.svg',
    );
  });
});

describe('firstEmoji', () => {
  it('returns the first emoji grapheme in a string', () => {
    expect(firstEmoji('hello 🔥 world ⭐')).toBe('🔥');
  });

  it('keeps multi-code-point sequences whole', () => {
    expect(firstEmoji('🏳️‍🌈!')).toBe('🏳️‍🌈');
    expect(firstEmoji('go 🇻🇳')).toBe('🇻🇳');
  });

  it('returns null when there is no emoji', () => {
    expect(firstEmoji('plain text')).toBeNull();
    expect(firstEmoji('')).toBeNull();
  });
});
