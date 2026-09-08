import type { FillType, ShapeKind } from '../model/types';
import { darken, lighten } from '../render/color';
import {
  AMBIGUOUS_SHAPE_WORDS,
  COLOR_MODIFIERS,
  COLOR_WORDS,
  EMOJI_WORDS,
  SHAPE_CONTEXT_WORDS,
  SHAPE_WORDS,
  STOP_WORDS,
  STYLES,
  THEMES,
  type Style,
  type Theme,
} from './lexicon';
import { EMOJI_KEYWORDS } from '../emoji/keywords';
import { sameWord, stripPlural, tokenize, wordForms } from './tokenize';

export interface ThemeMatch {
  theme: Theme;
  score: number;
  position: number;
}

export interface EmojiWordMatch {
  word: string;
  emoji: readonly string[];
  position: number;
  /** Curated words are strong signals; Unicode annotation words are a broad fallback. */
  source: 'curated' | 'unicode';
}

export interface ColorMatch {
  hex: string;
  name: string;
  position: number;
}

export interface PromptFlags {
  border?: boolean;
  shadow?: boolean;
  gloss?: boolean;
  transparent?: boolean;
  fill?: FillType;
  prefer?: 'emoji' | 'symbol' | 'text';
}

export interface ParsedPrompt {
  raw: string;
  tokens: string[];
  boundaries: ReadonlySet<number>;
  /** Background colors, in the order they were mentioned. */
  colors: ColorMatch[];
  /** A color the user tied to the icon itself ("white text", "gold crown on blue"). */
  contentColor: ColorMatch | null;
  themes: ThemeMatch[];
  emojiWords: EmojiWordMatch[];
  styles: Style[];
  shape: ShapeKind | null;
  text: string | null;
  emoji: string | null;
  flags: PromptFlags;
}

/** Negate the noun phrase right after them: "no border", "without any shadow". */
const NOUN_NEGATIONS = new Set(['no', 'without', 'minus', 'remove', 'less', 'instead']);
/** Negate the rest of the clause: "don't make it use emoji". */
const CLAUSE_NEGATIONS = new Set([
  'dont', 'doesnt', 'didnt', 'wont', 'cant', 'cannot', 'not', 'never', 'avoid', 'stop', 'skip', 'nothing',
]);
const CLAUSE_BREAKERS = new Set(['but', 'and', 'then', 'also', 'plus', 'however', 'except', 'while']);
const TEXT_MARKERS = new Set([
  'initial', 'initials', 'letter', 'letters', 'text', 'word', 'label', 'number', 'abbreviation',
  'abbr', 'acronym', 'saying', 'says', 'reads', 'labeled', 'labelled', 'written', 'writing',
]);
const NOT_TEXT = new Set(['color', 'colour', 'colors', 'colours', 'colored', 'coloured', 'size', 'style', 'font']);
const CONTENT_WORDS = new Set([
  'text', 'letters', 'letter', 'initials', 'initial', 'symbol', 'emoji', 'glyph', 'foreground',
  'font', 'number', 'word', 'crown', 'star', 'heart', 'skull', 'gem',
]);

/** Index of the first occurrence of a (possibly multi-word) keyword, or -1. */
export function findKeyword(
  tokens: readonly string[],
  keyword: string,
  consumed: ReadonlySet<number> = new Set(),
): number {
  const parts = keyword.toLowerCase().split(' ');
  outer: for (let i = 0; i + parts.length <= tokens.length; i++) {
    for (let j = 0; j < parts.length; j++) {
      const token = tokens[i + j];
      if (consumed.has(i + j) || !token) continue outer;
      // Stop words never stand in for a keyword ("make" must not match "maker").
      if (token !== parts[j] && STOP_WORDS.has(token)) continue outer;
      if (!sameWord(token, parts[j])) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Whether the word at `index` sits inside a negation. A clause negation
 * ("don't", "never") reaches back up to six words; a noun negation ("no",
 * "without") only three. Both stop at a clause boundary or a conjunction.
 */
export function isNegated(
  tokens: readonly string[],
  index: number,
  boundaries: ReadonlySet<number> = new Set(),
): boolean {
  for (let back = 1; back <= 6; back++) {
    const i = index - back;
    if (i < 0) return false;
    if (boundaries.has(i + 1)) return false;
    const word = tokens[i] ?? '';
    if (CLAUSE_BREAKERS.has(word)) return false;
    if (CLAUSE_NEGATIONS.has(word)) return true;
    if (NOUN_NEGATIONS.has(word)) return back <= 3;
  }
  return false;
}

function parseColors(
  tokens: readonly string[],
  hexes: readonly string[],
  consumed: Set<number>,
  boundaries: ReadonlySet<number>,
): ColorMatch[] {
  const colors: ColorMatch[] = hexes.map((hex) => ({ hex, name: hex, position: -1 }));
  tokens.forEach((token, i) => {
    const base = COLOR_WORDS[token];
    if (!base || isNegated(tokens, i, boundaries)) return;
    consumed.add(i);
    const prev = tokens[i - 1];
    const modifier = prev !== undefined ? COLOR_MODIFIERS[prev] : undefined;
    if (prev !== undefined && modifier !== undefined) {
      consumed.add(i - 1);
      colors.push({
        hex: modifier > 0 ? darken(base, modifier) : lighten(base, -modifier),
        name: `${prev} ${token}`,
        position: i,
      });
    } else {
      colors.push({ hex: base, name: token, position: i });
    }
  });
  return colors;
}

/** Splits off a color that describes the icon rather than the background. */
function splitContentColor(
  tokens: readonly string[],
  colors: ColorMatch[],
): { colors: ColorMatch[]; contentColor: ColorMatch | null } {
  let contentIndex = -1;
  colors.forEach((color, i) => {
    if (contentIndex >= 0 || color.position < 0) return;
    const next = tokens[color.position + 1];
    const prev = tokens[color.position - 1];
    const prev2 = tokens[color.position - 2];
    const following = colors[i + 1];
    const onIndex = tokens.indexOf('on', color.position);
    if (
      following &&
      following.position >= 0 &&
      onIndex > color.position &&
      onIndex < following.position &&
      following.position - color.position <= 4
    ) {
      contentIndex = i;
    } else if (
      (next !== undefined && CONTENT_WORDS.has(next)) ||
      (prev !== undefined && CONTENT_WORDS.has(prev)) ||
      (prev === 'in' && prev2 !== undefined && CONTENT_WORDS.has(prev2))
    ) {
      contentIndex = i;
    }
  });
  if (contentIndex < 0) return { colors, contentColor: null };
  const contentColor = colors[contentIndex] ?? null;
  return { colors: colors.filter((_, i) => i !== contentIndex), contentColor };
}

function parseShape(
  tokens: readonly string[],
  consumed: Set<number>,
  boundaries: ReadonlySet<number>,
): ShapeKind | null {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    if (isNegated(tokens, i, boundaries)) continue;
    const direct = SHAPE_WORDS[token] ?? SHAPE_WORDS[stripPlural(token)];
    if (direct) {
      consumed.add(i);
      return direct;
    }
    const ambiguous = AMBIGUOUS_SHAPE_WORDS[token] ?? AMBIGUOUS_SHAPE_WORDS[stripPlural(token)];
    const next = tokens[i + 1] ?? '';
    const prev = tokens[i - 1] ?? '';
    if (ambiguous && (SHAPE_CONTEXT_WORDS.includes(next) || SHAPE_CONTEXT_WORDS.includes(prev))) {
      consumed.add(i);
      return ambiguous;
    }
  }
  return null;
}

function parseText(tokens: readonly string[], quoted: readonly string[], consumed: Set<number>): string | null {
  const first = quoted[0];
  if (first) return Array.from(first).slice(0, 8).join('');
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i] ?? '';
    if (!TEXT_MARKERS.has(token)) continue;
    const next = tokens[i + 1] ?? '';
    if (STOP_WORDS.has(next) || NOT_TEXT.has(next) || COLOR_WORDS[next] || next.length > 8) continue;
    consumed.add(i);
    consumed.add(i + 1);
    return next.toUpperCase();
  }
  return null;
}

function matchThemes(
  tokens: readonly string[],
  consumed: ReadonlySet<number>,
  boundaries: ReadonlySet<number>,
): ThemeMatch[] {
  const matches: ThemeMatch[] = [];
  for (const theme of THEMES) {
    const hits = new Set<number>();
    let score = 0;
    for (const keyword of theme.keywords) {
      if (STOP_WORDS.has(keyword)) continue;
      const index = findKeyword(tokens, keyword, consumed);
      if (index < 0 || isNegated(tokens, index, boundaries) || hits.has(index)) continue;
      hits.add(index);
      score += keyword.includes(' ') ? 2 : 1;
    }
    if (score > 0) matches.push({ theme, score, position: Math.min(...hits) });
  }
  return matches.sort((a, b) => b.score - a.score || a.position - b.position);
}

/** Words from the Unicode annotations that are too vague to pick an icon from. */
const UNICODE_SKIP = new Set([
  'cool', 'new', 'free', 'back', 'ok', 'hot', 'top', 'open', 'right', 'sign', 'good', 'bad', 'big',
  'small', 'high', 'low', 'off', 'on', 'end', 'start', 'stop', 'go', 'make', 'made', 'use', 'like',
  'love', 'want', 'need', 'thing', 'things', 'one', 'two', 'three', 'ten', 'hundred', 'name', 'word',
  'text', 'type', 'style', 'kind', 'part', 'full', 'half', 'empty', 'next', 'last', 'first', 'second',
  'all', 'some', 'more', 'less', 'very', 'just', 'only', 'other', 'same', 'different', 'better', 'best',
  'day', 'week', 'month', 'year', 'now', 'soon', 'late', 'early', 'old', 'young', 'long', 'short',
  'hard', 'soft', 'fast', 'slow', 'cold', 'warm', 'wet', 'dry', 'ring', 'call', 'pin', 'post', 'mark',
  'check', 'cross', 'point', 'line', 'shape', 'colour', 'color', 'fill', 'border', 'shadow', 'icon',
  'role', 'server', 'chat', 'member', 'members', 'people', 'person', 'thanks', 'please', 'hello',
]);

function lookupUnicode(tokens: readonly string[], index: number): { key: string; emoji: readonly string[] } | null {
  const token = tokens[index] ?? '';
  const next = tokens[index + 1];
  if (next) {
    const phrase = `${token} ${next}`;
    const hit = EMOJI_KEYWORDS[phrase];
    if (hit) return { key: phrase, emoji: hit };
  }
  if (UNICODE_SKIP.has(token) || token.length < 3) return null;
  for (const form of wordForms(token)) {
    const hit = EMOJI_KEYWORDS[form];
    if (hit && !UNICODE_SKIP.has(form)) return { key: form, emoji: hit };
  }
  return null;
}

function matchEmojiWords(
  tokens: readonly string[],
  consumed: ReadonlySet<number>,
  boundaries: ReadonlySet<number>,
): EmojiWordMatch[] {
  const matches: EmojiWordMatch[] = [];
  tokens.forEach((token, i) => {
    if (consumed.has(i) || STOP_WORDS.has(token) || COLOR_WORDS[token] || isNegated(tokens, i, boundaries)) return;
    const curatedKey = EMOJI_WORDS[token] ? token : EMOJI_WORDS[stripPlural(token)] ? stripPlural(token) : null;
    const curated = curatedKey ? EMOJI_WORDS[curatedKey] : undefined;
    if (curatedKey && curated) {
      if (!matches.some((m) => m.word === curatedKey)) {
        matches.push({ word: curatedKey, emoji: curated, position: i, source: 'curated' });
      }
      return;
    }
    const unicode = lookupUnicode(tokens, i);
    if (unicode && !matches.some((m) => m.word === unicode.key)) {
      matches.push({ word: unicode.key, emoji: unicode.emoji.slice(0, 3), position: i, source: 'unicode' });
    }
  });
  return matches;
}

function matchStyles(
  tokens: readonly string[],
  consumed: ReadonlySet<number>,
  boundaries: ReadonlySet<number>,
): Style[] {
  const found: Array<{ style: Style; position: number }> = [];
  for (const style of STYLES) {
    let position = Number.POSITIVE_INFINITY;
    for (const keyword of style.keywords) {
      if (STOP_WORDS.has(keyword)) continue;
      const index = findKeyword(tokens, keyword, consumed);
      if (index >= 0 && !isNegated(tokens, index, boundaries)) position = Math.min(position, index);
    }
    if (position !== Number.POSITIVE_INFINITY) found.push({ style, position });
  }
  return found.sort((a, b) => a.position - b.position).map((f) => f.style);
}

function parseFlags(
  tokens: readonly string[],
  text: string | null,
  boundaries: ReadonlySet<number>,
): PromptFlags {
  const flag = (words: readonly string[]): boolean | undefined => {
    for (const word of words) {
      const index = findKeyword(tokens, word);
      if (index >= 0) return !isNegated(tokens, index, boundaries);
    }
    return undefined;
  };
  const flags: PromptFlags = {};
  const border = flag(['border', 'outline', 'ring', 'stroke', 'edge']);
  if (border !== undefined) flags.border = border;
  const shadow = flag(['shadow', 'shadows', 'drop shadow']);
  if (shadow !== undefined) flags.shadow = shadow;
  const gloss = flag(['glossy', 'gloss', 'shiny', 'shine', 'gleam', 'glass']);
  if (gloss !== undefined) flags.gloss = gloss;
  else if (flag(['flat', 'matte']) === true) flags.gloss = false;
  if (
    flag(['transparent', 'no background', 'without background', 'without a background']) === true ||
    findKeyword(tokens, 'no background') >= 0
  ) {
    flags.transparent = true;
  }
  if (flag(['solid']) === true) flags.fill = 'solid';
  else if (flag(['radial']) === true) flags.fill = 'radial';
  else if (flag(['gradient']) === true) flags.fill = 'linear';
  const emoji = flag(['emoji', 'emojis']);
  const symbol = flag(['symbol', 'symbols', 'glyph', 'silhouette', 'drawn']);
  if (text) flags.prefer = 'text';
  else if (emoji === true || symbol === false) flags.prefer = 'emoji';
  else if (symbol === true || emoji === false) flags.prefer = 'symbol';
  return flags;
}

/** Turns a free-text description into everything the generator needs. */
export function parsePrompt(input: string): ParsedPrompt {
  const { raw, tokens, quoted, hexes, emoji, boundaries } = tokenize(input);
  const consumed = new Set<number>();
  const { colors, contentColor } = splitContentColor(
    tokens,
    parseColors(tokens, hexes, consumed, boundaries),
  );
  let shape = parseShape(tokens, consumed, boundaries);
  const text = parseText(tokens, quoted, consumed);
  const flags = parseFlags(tokens, text, boundaries);
  if (flags.transparent) shape = 'none';
  return {
    raw,
    tokens,
    boundaries,
    colors,
    contentColor,
    themes: matchThemes(tokens, consumed, boundaries),
    emojiWords: matchEmojiWords(tokens, consumed, boundaries),
    styles: matchStyles(tokens, consumed, boundaries),
    shape,
    text,
    emoji: emoji[0] ?? null,
    flags,
  };
}
