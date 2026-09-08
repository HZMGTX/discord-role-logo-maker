import { DEFAULT_ICON, cloneIcon } from '../model/defaults';
import { sanitizeIcon } from '../model/serialize';
import {
  ROLE_COLORS,
  SHAPE_LABELS,
  type Content,
  type FillType,
  type FontId,
  type IconState,
  type ShapeKind,
  type SymbolId,
} from '../model/types';
import { colorDistance, darken, luminance } from '../render/color';
import { SYMBOLS } from '../render/symbols';
import {
  GENERIC_EMOJI,
  GENERIC_PALETTES,
  GENERIC_SHAPES,
  GENERIC_SYMBOLS,
  type Palette,
  type Style,
  type Theme,
} from './lexicon';
import { parsePrompt, type ParsedPrompt } from './parse';
import { cycle, hashString, mulberry32, pick } from './rng';

export interface Idea {
  id: string;
  icon: IconState;
  roleName: string | null;
  roleColor: string;
  caption: string;
}

export interface AssistantResult {
  reply: string;
  ideas: Idea[];
  parsed: ParsedPrompt;
  /** False when nothing in the prompt was recognised and the ideas are generic. */
  understood: boolean;
}

export const EXAMPLE_PROMPTS: readonly string[] = [
  'Gold crown for the server owner',
  'Cute pink icon for the artists',
  'Neon hexagon for gamers',
  'Blue shield shape for moderators, professional',
  'Spooky Halloween helper',
  'Initials MD in bold white on navy',
  '🐸 on a green badge',
];

const TEXT_FONTS: readonly FontId[] = ['inter', 'bangers', 'bebas', 'blackops'];

export function nearestRoleColor(hex: string): string {
  let best: string = ROLE_COLORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of ROLE_COLORS) {
    const distance = colorDistance(hex, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

export function contentLabel(content: Content): string {
  switch (content.kind) {
    case 'emoji':
      return content.emoji;
    case 'symbol':
      return SYMBOLS[content.symbol].label.toLowerCase();
    case 'text':
      return `“${content.text}”`;
    case 'image':
      return 'image';
    case 'none':
      return 'plain';
  }
}

function dedupe<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

/** Emoji that would sit awkwardly inside the same-shaped background. */
const SHAPE_EMOJI_CONFLICTS: Partial<Record<ShapeKind, readonly string[]>> = {
  shield: ['🛡️'],
  star: ['⭐', '🌟'],
  heart: ['❤️', '💖', '💕', '💗', '🫶', '🧡', '💛', '💚', '💙', '💜'],
  diamond: ['💎'],
};

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function isLight(hex: string): boolean {
  return luminance(hex) > 0.45;
}

interface Ingredients {
  contents: Content[];
  palettes: Palette[];
  shapes: ShapeKind[];
  fills: FillType[];
  theme: Theme | null;
  styles: Style[];
  generic: boolean;
  contentColor: string | null;
  border: boolean | null;
  gloss: boolean | null;
  shadow: boolean | null;
  glow: boolean;
  contentShadow: boolean | null;
}

function buildIngredients(parsed: ParsedPrompt): Ingredients {
  const theme = parsed.themes[0]?.theme ?? null;
  const secondary = parsed.themes[1]?.theme ?? null;
  const styles = parsed.styles;
  const prefer = parsed.flags.prefer ?? styles.find((s) => s.prefer)?.prefer ?? null;
  const font = styles.find((s) => s.font)?.font ?? null;
  let generic = false;

  const contents: Content[] = [];
  if (parsed.emoji) {
    contents.push({ kind: 'emoji', emoji: parsed.emoji, shadow: false });
  } else if (parsed.text) {
    const fonts = font ? [font, ...TEXT_FONTS.filter((f) => f !== font)] : TEXT_FONTS;
    for (const f of fonts) {
      contents.push({
        kind: 'text',
        text: parsed.text,
        font: f,
        weight: 900,
        color: '#ffffff',
        letterSpacing: 0.02,
        stroke: null,
        shadow: false,
      });
    }
  } else {
    const emojiList: string[] = [];
    const symbolList: SymbolId[] = [];
    for (const word of parsed.emojiWords) if (word.source === 'curated') emojiList.push(...word.emoji);
    if (theme) {
      emojiList.push(...theme.emoji);
      symbolList.push(...theme.symbols);
    }
    for (const word of parsed.emojiWords) if (word.source === 'unicode') emojiList.push(...word.emoji);
    if (secondary && parsed.emojiWords.length === 0) {
      emojiList.push(...secondary.emoji.slice(0, 1));
      symbolList.push(...secondary.symbols.slice(0, 1));
    }
    for (const style of styles) {
      if (style.emoji) emojiList.push(...style.emoji);
      if (style.symbols) symbolList.push(...style.symbols);
    }
    const conflicts = parsed.shape ? (SHAPE_EMOJI_CONFLICTS[parsed.shape] ?? []) : [];
    const emoji = dedupe(emojiList).filter((e) => !conflicts.includes(e));
    const symbols = dedupe(symbolList).filter((s) => s !== parsed.shape);
    if (emoji.length === 0 && symbols.length === 0) {
      generic = true;
      emoji.push(...GENERIC_EMOJI);
      symbols.push(...GENERIC_SYMBOLS.filter((s) => s !== parsed.shape));
    }
    const asEmoji = (e: string): Content => ({ kind: 'emoji', emoji: e, shadow: false });
    const asSymbol = (s: SymbolId): Content => ({ kind: 'symbol', symbol: s, color: '#ffffff', shadow: false });
    if (prefer === 'symbol') {
      contents.push(...symbols.map(asSymbol), ...emoji.map(asEmoji));
    } else if (prefer === 'emoji') {
      contents.push(...emoji.map(asEmoji), ...symbols.map(asSymbol));
    } else {
      const longest = Math.max(emoji.length, symbols.length);
      for (let i = 0; i < longest; i++) {
        const e = emoji[i];
        const s = symbols[i];
        if (e !== undefined) contents.push(asEmoji(e));
        if (s !== undefined) contents.push(asSymbol(s));
      }
    }
  }

  const explicit = parsed.colors.map((c) => c.hex);
  let palettes: Palette[] = [];
  const [c0, c1] = explicit;
  if (c0 !== undefined && c1 !== undefined) {
    palettes = [[c0, c1], [c0, darken(c0, 0.35)], [c1, c0]];
  } else if (c0 !== undefined) {
    palettes = [[c0, darken(c0, 0.4)], [c0, darken(c0, 0.22)], [c0, c0]];
  } else if (parsed.contentColor) {
    // Only the icon's own color was given: pick backgrounds it will stand out against.
    const iconColor = parsed.contentColor.hex;
    const candidates = [
      ...styles.flatMap((s) => s.palettes ?? []),
      ...(theme?.palettes ?? []),
      ...GENERIC_PALETTES,
    ].filter(([background]) => colorDistance(background, iconColor) > 90);
    palettes = candidates.length > 0 ? candidates : [[darken(iconColor, 0.55), darken(iconColor, 0.75)]];
  } else {
    for (const style of styles) if (style.palettes) palettes.push(...style.palettes);
    if (theme) palettes.push(...theme.palettes);
    if (palettes.length === 0) palettes = [...GENERIC_PALETTES];
  }

  const shapes: ShapeKind[] = parsed.shape
    ? [parsed.shape]
    : dedupe([...styles.flatMap((s) => s.shapes ?? []), ...(theme?.shapes ?? []), ...GENERIC_SHAPES]);

  const styleFill = styles.find((s) => s.fillType)?.fillType;
  const fills: FillType[] = parsed.flags.fill
    ? [parsed.flags.fill]
    : styleFill
      ? [styleFill, styleFill, 'linear']
      : ['linear', 'radial', 'linear', 'solid'];

  return {
    contents,
    palettes,
    shapes,
    fills,
    theme,
    styles,
    generic,
    contentColor:
      parsed.contentColor?.hex ?? styles.find((s) => s.contentColor)?.contentColor ?? theme?.contentColor ?? null,
    border: parsed.flags.border ?? styles.find((s) => s.border !== undefined)?.border ?? theme?.border ?? null,
    gloss: parsed.flags.gloss ?? styles.find((s) => s.gloss !== undefined)?.gloss ?? theme?.gloss ?? null,
    shadow: parsed.flags.shadow ?? styles.find((s) => s.shadow !== undefined)?.shadow ?? null,
    glow: styles.some((s) => s.glow),
    contentShadow: styles.find((s) => s.contentShadow !== undefined)?.contentShadow ?? null,
  };
}

function withColor(content: Content, color: string): Content {
  if (content.kind === 'symbol' || content.kind === 'text') return { ...content, color };
  return content;
}

function buildIcon(
  ingredients: Ingredients,
  content: Content,
  shape: ShapeKind,
  palette: Palette,
  fill: FillType,
  rng: () => number,
): IconState {
  const icon = cloneIcon(DEFAULT_ICON);
  const [color1, color2] = palette;
  const light = fill === 'solid' ? isLight(color1) : isLight(color1) && isLight(color2);
  const foreground = ingredients.contentColor ?? (light ? darken(color2, 0.5) : '#ffffff');

  icon.shape = shape;
  icon.cornerRadius = Math.round((0.2 + rng() * 0.14) * 100) / 100;
  icon.fill = { type: fill, color1, color2, angle: pick(rng, [135, 160, 45, 90, 180]) };
  icon.content = withColor(content, foreground);
  if ('shadow' in icon.content) {
    icon.content.shadow = ingredients.contentShadow ?? rng() < 0.3;
  }

  const wantBorder = ingredients.border ?? rng() < 0.5;
  icon.border = wantBorder
    ? { width: pick(rng, [0.03, 0.04, 0.05]), color: ingredients.contentColor ?? (light ? darken(color2, 0.35) : '#ffffff') }
    : { width: 0, color: '#ffffff' };
  icon.gloss = ingredients.gloss ?? rng() < 0.3;
  icon.shadow = ingredients.glow
    ? { enabled: true, blur: 0.08, opacity: 0.6, dx: 0, dy: 0, color: color1 }
    : { ...DEFAULT_ICON.shadow, enabled: ingredients.shadow ?? rng() < 0.25 };
  icon.transform = {
    ...DEFAULT_ICON.transform,
    scale: content.kind === 'text' ? 1 : pick(rng, [0.95, 1, 1.05, 1.1]),
  };

  if (shape === 'none') {
    icon.border.width = 0;
    icon.gloss = false;
    icon.shadow.enabled = false;
    icon.transform.scale = 1.3;
  }
  return sanitizeIcon(icon);
}

function fillLabel(fill: FillType): string {
  return fill === 'solid' ? 'solid' : fill === 'radial' ? 'radial' : 'gradient';
}

function describe(parsed: ParsedPrompt, ingredients: Ingredients, count: number): string {
  const parts: string[] = [];
  const { theme, styles, generic } = ingredients;
  if (parsed.emoji) parts.push(`I used your ${parsed.emoji} as the icon.`);
  else if (parsed.text) parts.push(`I put “${parsed.text}” on it in a few fonts.`);
  if (theme) {
    parts.push(`For ${theme.label.toLowerCase()} I picked ${theme.reason}.`);
  } else if (parsed.emojiWords.length > 0 && !parsed.emoji && !parsed.text) {
    const words = parsed.emojiWords.map((w) => w.word).join(', ');
    const emoji = parsed.emojiWords.map((w) => w.emoji[0] ?? '').join(' ');
    parts.push(`I went with ${emoji} for “${words}”.`);
  }
  if (parsed.colors.length > 0) parts.push(`Colors: ${parsed.colors.map((c) => c.name).join(', ')}.`);
  if (parsed.contentColor) parts.push(`Icon color: ${parsed.contentColor.name}.`);
  if (styles.length > 0) parts.push(`Style: ${styles.map((s) => s.label).join(', ')}.`);
  if (parsed.shape) parts.push(`Shape: ${SHAPE_LABELS[parsed.shape].toLowerCase()}.`);

  const recognised = parts.length > 0;
  const intro = generic && !recognised
    ? "I couldn't tell what the role is about, so here are a few all-rounders."
    : `Here are ${count} ideas.`;
  const outro = generic && !recognised
    ? 'Try naming the role (admin, artist, gamer…), a color, a mood, or paste an emoji.'
    : 'Click one to load it, then tweak anything.';
  return [intro, ...parts, outro].join(' ');
}

/** Turns a description into several complete icon designs. Same prompt and seed give the same ideas. */
export function generateIdeas(prompt: string, seed = 0, count = 6): AssistantResult {
  const parsed = parsePrompt(prompt);
  const ingredients = buildIngredients(parsed);
  const { contents, palettes, shapes, fills } = ingredients;
  const base = hashString(prompt.trim().toLowerCase());
  const firstWord = parsed.emojiWords[0];
  const themeScore = parsed.themes[0]?.score ?? 0;
  const roleName =
    firstWord && (firstWord.source === 'curated' || !ingredients.theme) && themeScore <= 1 && !parsed.text
      ? capitalize(firstWord.word)
      : (ingredients.theme?.label ?? parsed.text ?? null);
  const ideas: Idea[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    const rng = mulberry32((base ^ Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0);
    const content = cycle(contents, i);
    let shape = cycle(shapes, i + Math.floor(i / contents.length));
    let paletteIndex = i * 2 + Math.floor(i / shapes.length);
    let fill = cycle(fills, i);
    let key = '';
    for (let attempt = 0; attempt < palettes.length * shapes.length + 2; attempt++) {
      key = `${shape}|${contentLabel(content)}|${cycle(palettes, paletteIndex).join()}|${fill}`;
      if (!seen.has(key)) break;
      paletteIndex += 1;
      if (attempt % palettes.length === palettes.length - 1) shape = cycle(shapes, shapes.indexOf(shape) + 1);
      if (attempt === palettes.length * shapes.length) fill = cycle(fills, fills.indexOf(fill) + 1);
    }
    seen.add(key);
    const palette = cycle(palettes, paletteIndex);
    const icon = buildIcon(ingredients, content, shape, palette, fill, rng);
    ideas.push({
      id: `idea-${seed}-${i}`,
      icon,
      roleName,
      roleColor: nearestRoleColor(palette[0]),
      caption: `${SHAPE_LABELS[shape]} · ${contentLabel(content)} · ${fillLabel(fill)}`,
    });
  }

  const recognised =
    !ingredients.generic ||
    parsed.colors.length > 0 ||
    parsed.styles.length > 0 ||
    parsed.shape !== null ||
    parsed.text !== null ||
    parsed.emoji !== null;
  return { reply: describe(parsed, ingredients, ideas.length), ideas, parsed, understood: recognised };
}
