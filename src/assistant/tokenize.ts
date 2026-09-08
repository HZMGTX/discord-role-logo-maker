import { allEmoji } from '../emoji/twemoji';

export interface Tokenized {
  raw: string;
  tokens: string[];
  quoted: string[];
  hexes: string[];
  emoji: string[];
  /** Indices of tokens that start a new clause (after a comma, period, etc.). */
  boundaries: Set<number>;
}

const DOUBLE_QUOTED = /["“”„]([^"“”„]{1,8})["“”„]/g;
const SINGLE_QUOTED = /(^|\s)'([^'\s]{1,8})'(?=\s|$)/g;
const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/gi;

export function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

/** A crude singular form: good enough to match "artists" against "artist". */
export function stripPlural(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

const MIN_STEM = 4;

/**
 * Candidate base forms of a word, so "coding" matches "code", "gamers"
 * matches "game" and "verified" matches "verify". Deliberately loose: two
 * words only match when they share a form, which keeps false positives rare.
 */
export function wordForms(word: string): string[] {
  const forms = new Set<string>([word]);
  const add = (form: string) => {
    if (form.length >= MIN_STEM) forms.add(form);
  };
  const singular = stripPlural(word);
  forms.add(singular);
  for (const base of new Set([word, singular])) {
    const doubled = (stem: string) =>
      stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] ? stem.slice(0, -1) : null;
    if (base.endsWith('ing') && base.length > 5) {
      const stem = base.slice(0, -3);
      add(stem);
      add(`${stem}e`);
      const undoubled = doubled(stem);
      if (undoubled) add(undoubled);
    }
    if (base.endsWith('ed') && base.length > 4) {
      const stem = base.slice(0, -2);
      add(stem);
      add(`${stem}e`);
      if (stem.endsWith('i')) add(`${stem.slice(0, -1)}y`);
      const undoubled = doubled(stem);
      if (undoubled) add(undoubled);
    }
    if (base.endsWith('er') && base.length > 4) {
      const stem = base.slice(0, -2);
      add(stem);
      add(`${stem}e`);
    }
    if (base.endsWith('ly') && base.length > 4) add(base.slice(0, -2));
    if (base.endsWith('ness') && base.length > 6) add(base.slice(0, -4));
    if (base.endsWith('ful') && base.length > 5) add(base.slice(0, -3));
    if (base.endsWith('ish') && base.length > 5) add(base.slice(0, -3));
    if (base.endsWith('y') && base.length > 4) add(base.slice(0, -1));
    if (base.endsWith('e') && base.length > 4) add(base.slice(0, -1));
  }
  return [...forms];
}

/** Whether two words are the same word in some form ("artist" / "artists", "code" / "coding"). */
export function sameWord(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const formsOfB = new Set(wordForms(b));
  return wordForms(a).some((form) => formsOfB.has(form));
}

export function tokenize(input: string): Tokenized {
  const emoji = allEmoji(input);
  const quoted: string[] = [];
  const hexes: string[] = [];
  let text = input.replace(DOUBLE_QUOTED, (_match, inner: string) => {
    quoted.push(inner);
    return ' ';
  });
  text = text.replace(SINGLE_QUOTED, (_match, lead: string, inner: string) => {
    quoted.push(inner);
    return `${lead} `;
  });
  text = text.replace(HEX, (match) => {
    hexes.push(normalizeHex(match));
    return ' ';
  });
  for (const e of emoji) text = text.split(e).join(' ');
  const pieces = text
    .replace(/['’]/g, '')
    .replace(/[,.;:!?\n]+/g, ' | ')
    .toLowerCase()
    .replace(/[^a-z0-9\-\s|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const tokens: string[] = [];
  const boundaries = new Set<number>();
  let pendingBoundary = false;
  for (const piece of pieces) {
    if (piece === '|') {
      pendingBoundary = tokens.length > 0;
      continue;
    }
    if (pendingBoundary) {
      boundaries.add(tokens.length);
      pendingBoundary = false;
    }
    if (piece.includes('-')) tokens.push(piece, ...piece.split('-').filter(Boolean));
    else tokens.push(piece);
  }
  return { raw: input, tokens, quoted, hexes, emoji, boundaries };
}
