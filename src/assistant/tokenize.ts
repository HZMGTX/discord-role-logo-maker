import { allEmoji } from '../emoji/twemoji';

export interface Tokenized {
  raw: string;
  tokens: string[];
  quoted: string[];
  hexes: string[];
  emoji: string[];
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
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\-\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) =>
      token.includes('-') ? [token, ...token.split('-').filter(Boolean)] : [token],
    );
  return { raw: input, tokens, quoted, hexes, emoji };
}
