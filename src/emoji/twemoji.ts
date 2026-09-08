export const TWEMOJI_VERSION = '15.1.0';
export const TWEMOJI_BASE = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg/`;

const VARIATION_SELECTOR_16 = 0xfe0f;
const ZERO_WIDTH_JOINER = 0x200d;

export function toCodePoints(emoji: string): number[] {
  return Array.from(emoji, (ch) => ch.codePointAt(0) ?? 0).filter((cp) => cp > 0);
}

/**
 * Twemoji file name for an emoji (without extension). Mirrors twemoji's
 * `grabTheRightIcon`: U+FE0F is dropped unless the sequence contains a ZWJ.
 */
export function twemojiFile(emoji: string): string {
  const cps = toCodePoints(emoji);
  const kept = cps.includes(ZERO_WIDTH_JOINER)
    ? cps
    : cps.filter((cp) => cp !== VARIATION_SELECTOR_16);
  return kept.map((cp) => cp.toString(16)).join('-');
}

export function twemojiUrl(emoji: string): string {
  return `${TWEMOJI_BASE}${twemojiFile(emoji)}.svg`;
}

const EMOJI_TEST = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;

function graphemes(input: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(input), (s) => s.segment);
  }
  return Array.from(input);
}

/** The first emoji grapheme in a string, or null when it contains none. */
export function firstEmoji(input: string): string | null {
  for (const g of graphemes(input)) {
    if (EMOJI_TEST.test(g)) return g;
  }
  return null;
}
