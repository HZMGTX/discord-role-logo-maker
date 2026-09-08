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
import { stripPlural, tokenize } from './tokenize';

export interface ThemeMatch {
  theme: Theme;
  score: number;
  position: number;
}

export interface EmojiWordMatch {
  word: string;
  emoji: readonly string[];
  position: number;
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

const NEGATIONS = new Set(['no', 'without', 'not', 'dont', 'never', 'remove', 'less', 'minus']);
const FILLERS = new Set(['a', 'an', 'the', 'any', 'some']);
const TEXT_MARKERS = new Set([
  'initial', 'initials', 'letter', 'letters', 'text', 'word', 'label', 'number', 'abbreviation',
  'abbr', 'acronym', 'saying', 'says', 'reads', 'labeled', 'labelled', 'written', 'writing',
]);
const NOT_TEXT = new Set(['color', 'colour', 'colors', 'colours', 'colored', 'coloured', 'size', 'style', 'font']);
const CONTENT_WORDS = new Set([
  'text', 'letters', 'letter', 'initials', 'initial', 'symbol', 'emoji', 'glyph', 'foreground',
  'font', 'number', 'word', 'crown', 'star', 'heart', 'skull', 'gem',
]);

export function sameWord(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a === b || stripPlural(a) === stripPlural(b);
}

/** Index of the first occurrence of a (possibly multi-word) keyword, or -1. */
export function findKeyword(
  tokens: readonly string[],
  keyword: string,
  consumed: ReadonlySet<number> = new Set(),
): number {
  const parts = keyword.toLowerCase().split(' ');
  outer: for (let i = 0; i + parts.length <= tokens.length; i++) {
    for (let j = 0; j < parts.length; j++) {
      if (consumed.has(i + j) || !sameWord(tokens[i + j], parts[j])) continue outer;
    }
    return i;
  }
  return -1;
}

export function isNegated(tokens: readonly string[], index: number): boolean {
  const prev = tokens[index - 1];
  if (prev && NEGATIONS.has(prev)) return true;
  const prev2 = tokens[index - 2];
  return !!prev && !!prev2 && FILLERS.has(prev) && NEGATIONS.has(prev2);
}

function parseColors(tokens: readonly string[], hexes: readonly string[], consumed: Set<number>): ColorMatch[] {
  const colors: ColorMatch[] = hexes.map((hex) => ({ hex, name: hex, position: -1 }));
  tokens.forEach((token, i) => {
    const base = COLOR_WORDS[token];
    if (!base || isNegated(tokens, i)) return;
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

function parseShape(tokens: readonly string[], consumed: Set<number>): ShapeKind | null {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    if (isNegated(tokens, i)) continue;
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

function matchThemes(tokens: readonly string[], consumed: ReadonlySet<number>): ThemeMatch[] {
  const matches: ThemeMatch[] = [];
  for (const theme of THEMES) {
    let score = 0;
    let position = Number.POSITIVE_INFINITY;
    for (const keyword of theme.keywords) {
      if (STOP_WORDS.has(keyword)) continue;
      const index = findKeyword(tokens, keyword, consumed);
      if (index < 0 || isNegated(tokens, index)) continue;
      score += keyword.includes(' ') ? 2 : 1;
      position = Math.min(position, index);
    }
    if (score > 0) matches.push({ theme, score, position });
  }
  return matches.sort((a, b) => b.score - a.score || a.position - b.position);
}

function matchEmojiWords(tokens: readonly string[], consumed: ReadonlySet<number>): EmojiWordMatch[] {
  const matches: EmojiWordMatch[] = [];
  tokens.forEach((token, i) => {
    if (consumed.has(i) || STOP_WORDS.has(token) || COLOR_WORDS[token] || isNegated(tokens, i)) return;
    const key = EMOJI_WORDS[token] ? token : EMOJI_WORDS[stripPlural(token)] ? stripPlural(token) : null;
    const emoji = key ? EMOJI_WORDS[key] : undefined;
    if (!key || !emoji || matches.some((m) => m.word === key)) return;
    matches.push({ word: key, emoji, position: i });
  });
  return matches;
}

function matchStyles(tokens: readonly string[], consumed: ReadonlySet<number>): Style[] {
  const found: Array<{ style: Style; position: number }> = [];
  for (const style of STYLES) {
    let position = Number.POSITIVE_INFINITY;
    for (const keyword of style.keywords) {
      if (STOP_WORDS.has(keyword)) continue;
      const index = findKeyword(tokens, keyword, consumed);
      if (index >= 0 && !isNegated(tokens, index)) position = Math.min(position, index);
    }
    if (position !== Number.POSITIVE_INFINITY) found.push({ style, position });
  }
  return found.sort((a, b) => a.position - b.position).map((f) => f.style);
}

function flag(tokens: readonly string[], words: readonly string[]): boolean | undefined {
  for (const word of words) {
    const index = findKeyword(tokens, word);
    if (index >= 0) return !isNegated(tokens, index);
  }
  return undefined;
}

function parseFlags(tokens: readonly string[], text: string | null): PromptFlags {
  const flags: PromptFlags = {};
  const border = flag(tokens, ['border', 'outline', 'ring', 'stroke', 'edge']);
  if (border !== undefined) flags.border = border;
  const shadow = flag(tokens, ['shadow', 'shadows', 'drop shadow']);
  if (shadow !== undefined) flags.shadow = shadow;
  const gloss = flag(tokens, ['glossy', 'gloss', 'shiny', 'shine', 'gleam', 'glass']);
  if (gloss !== undefined) flags.gloss = gloss;
  else if (flag(tokens, ['flat', 'matte']) === true) flags.gloss = false;
  if (
    flag(tokens, ['transparent', 'no background', 'without background', 'without a background']) === true ||
    findKeyword(tokens, 'no background') >= 0
  ) {
    flags.transparent = true;
  }
  if (flag(tokens, ['solid']) === true) flags.fill = 'solid';
  else if (flag(tokens, ['radial']) === true) flags.fill = 'radial';
  else if (flag(tokens, ['gradient']) === true) flags.fill = 'linear';
  if (text) flags.prefer = 'text';
  else if (flag(tokens, ['emoji', 'emojis']) === true) flags.prefer = 'emoji';
  else if (flag(tokens, ['symbol', 'symbols', 'glyph', 'silhouette']) === true) flags.prefer = 'symbol';
  return flags;
}

/** Turns a free-text description into everything the generator needs. */
export function parsePrompt(input: string): ParsedPrompt {
  const { raw, tokens, quoted, hexes, emoji } = tokenize(input);
  const consumed = new Set<number>();
  const { colors, contentColor } = splitContentColor(tokens, parseColors(tokens, hexes, consumed));
  let shape = parseShape(tokens, consumed);
  const text = parseText(tokens, quoted, consumed);
  const flags = parseFlags(tokens, text);
  if (flags.transparent) shape = 'none';
  return {
    raw,
    tokens,
    colors,
    contentColor,
    themes: matchThemes(tokens, consumed),
    emojiWords: matchEmojiWords(tokens, consumed),
    styles: matchStyles(tokens, consumed),
    shape,
    text,
    emoji: emoji[0] ?? null,
    flags,
  };
}
