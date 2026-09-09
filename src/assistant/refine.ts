import { cloneIcon } from '../model/defaults';
import { ensureTopLayer } from '../model/layers';
import { randomizeIcon } from '../model/random';
import { sanitizeIcon } from '../model/serialize';
import {
  RANGES,
  SHAPE_LABELS,
  type Content,
  type Fill,
  type IconState,
  type SymbolId,
} from '../model/types';
import { darken, lighten, luminance } from '../render/color';
import { SYMBOLS } from '../render/symbols';
import { findKeyword, isNegated, parsePrompt, type ParsedPrompt } from './parse';

export interface Refinement {
  icon: IconState;
  reply: string;
  roleName?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function has(
  tokens: readonly string[],
  words: readonly string[],
  boundaries: ReadonlySet<number> = new Set(),
): boolean {
  return words.some((word) => {
    const index = findKeyword(tokens, word);
    return index >= 0 && !isNegated(tokens, index, boundaries);
  });
}

const EMOJI_TO_SYMBOL: Readonly<Record<string, SymbolId>> = {
  '🛡️': 'shield', '👑': 'crown', '⭐': 'star', '🌟': 'star', '❤️': 'heart', '💖': 'heart', '⚡': 'bolt',
  '✅': 'check', '☑️': 'check', '❌': 'cross', '⚙️': 'gear', '💎': 'gem', '⚔️': 'sword', '🗡️': 'sword',
  '💀': 'skull', '☠️': 'skull', '🎵': 'note', '🎶': 'note', '💻': 'code', '🔥': 'flame', '🌙': 'moon',
  '🐾': 'paw', '🏆': 'trophy', '🔑': 'key', '🗝️': 'key',
};

const SYMBOL_TO_EMOJI: Readonly<Record<SymbolId, string>> = {
  crown: '👑', shield: '🛡️', star: '⭐', heart: '❤️', bolt: '⚡', check: '✅', cross: '❌', gear: '⚙️',
  gem: '💎', sword: '⚔️', skull: '💀', note: '🎵', code: '💻', flame: '🔥', moon: '🌙', paw: '🐾',
  trophy: '🏆', key: '🔑',
};

const POLISH_WORDS: readonly string[] = [
  'better', 'nicer', 'improve', 'improved', 'polish', 'polished', 'prettier', 'cooler', 'fancier', 'pop',
  'upgrade', 'enhance', 'enhanced', 'spice', 'jazz', 'refine', 'finish', 'touch up',
];

function foregroundFor(icon: IconState): string {
  const light = luminance(icon.background.fill.color1) > 0.45 && (icon.background.fill.type === 'solid' || luminance(icon.background.fill.color2) > 0.45);
  return light ? darken(icon.background.fill.color2, 0.5) : '#ffffff';
}

function joinChanges(changes: readonly string[]): string {
  if (changes.length === 0) return '';
  if (changes.length === 1) return changes[0] ?? '';
  return `${changes.slice(0, -1).join(', ')} and ${changes[changes.length - 1] ?? ''}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Sets both ends of a fill and drops any middle colors. Those belonged to the
 * palette being replaced, so keeping them leaves a stripe of the old color
 * across the new one.
 */
function repaintFill(fill: Fill, color1: string, color2: string): void {
  fill.color1 = color1;
  fill.color2 = color2;
  fill.stops = [];
}

/** Applies a color transform to every color in a fill, middles included. */
function shadeFill(fill: Fill, shade: (hex: string) => string): void {
  fill.color1 = shade(fill.color1);
  fill.color2 = shade(fill.color2);
  for (const stop of fill.stops) stop.color = shade(stop.color);
}

/** The color a glow should take, when the content has one of its own. */
function contentColorOf(content: Content): string | null {
  if (content.kind === 'symbol' || content.kind === 'text') return content.color;
  if (content.kind === 'shape') return content.fill.color1;
  return null;
}

function setContentColor(content: Content, color: string): boolean {
  if (content.kind === 'symbol' || content.kind === 'text') {
    content.color = color;
    return true;
  }
  return false;
}

function pickContent(parsed: ParsedPrompt, current: Content): { content: Content; label: string } | null {
  if (parsed.emoji) {
    return { content: { kind: 'emoji', emoji: parsed.emoji, shadow: false }, label: parsed.emoji };
  }
  if (parsed.text) {
    const base =
      current.kind === 'text'
        ? current
        : {
            kind: 'text' as const,
            text: '',
            font: 'inter' as const,
            customFont: null,
            weight: 900 as const,
            color: '#ffffff',
            letterSpacing: 0.02,
            stroke: null,
            shadow: false,
          };
    return { content: { ...base, text: parsed.text }, label: `“${parsed.text}”` };
  }
  const theme = parsed.themes[0]?.theme;
  const word = parsed.emojiWords[0];
  const color = current.kind === 'symbol' || current.kind === 'text' ? current.color : '#ffffff';
  const shadow = 'shadow' in current ? current.shadow : false;
  if (word) {
    const emoji = word.emoji[0];
    if (emoji) return { content: { kind: 'emoji', emoji, shadow }, label: emoji };
  }
  if (theme) {
    const symbol = theme.symbols[0];
    const emoji = theme.emoji[0];
    const preferSymbol = parsed.flags.prefer === 'symbol' || (current.kind === 'symbol' && parsed.flags.prefer !== 'emoji');
    if (preferSymbol && symbol) {
      return { content: { kind: 'symbol', symbol, color, shadow }, label: SYMBOLS[symbol].label.toLowerCase() };
    }
    if (emoji) return { content: { kind: 'emoji', emoji, shadow }, label: emoji };
    if (symbol) return { content: { kind: 'symbol', symbol, color, shadow }, label: SYMBOLS[symbol].label.toLowerCase() };
  }
  return null;
}

/**
 * Applies a follow-up instruction ("make it darker", "add a border", "use a
 * skull", "hexagon", "more blue") to an existing icon. Returns null when
 * nothing in the instruction was understood.
 */
export function refineIcon(current: IconState, prompt: string): Refinement | null {
  const parsed = parsePrompt(prompt);
  const { tokens: words, boundaries } = parsed;
  const tokens = words;
  const say = (list: readonly string[]) => has(tokens, list, boundaries);
  const icon = cloneIcon(current);
  const layer = ensureTopLayer(icon);
  const changes: string[] = [];
  let roleName: string | undefined;

  if (say(['random', 'surprise', 'shuffle', 'reroll', 'something else', 'anything'])) {
    return { icon: randomizeIcon(), reply: 'Rolled a fresh random design.' };
  }

  // Colors and brightness
  const mentionsContent = say(['icon', 'symbol', 'text', 'letters', 'letter', 'glyph', 'content', 'foreground']);
  const mentionsBorder = say(['border', 'outline', 'ring']);
  const firstColor = parsed.colors[0];
  const secondColor = parsed.colors[1];
  if (parsed.contentColor) {
    if (setContentColor(layer.content, parsed.contentColor.hex)) {
      changes.push(`colored the ${layer.content.kind} ${parsed.contentColor.name}`);
    } else {
      icon.background.border.color = parsed.contentColor.hex;
      changes.push(`used ${parsed.contentColor.name} for the border (emoji keep their own colors)`);
    }
  }
  if (firstColor) {
    if (mentionsContent && setContentColor(layer.content, firstColor.hex)) {
      changes.push(`colored the ${layer.content.kind} ${firstColor.name}`);
    } else if (mentionsContent && !mentionsBorder) {
      repaintFill(
        icon.background.fill,
        firstColor.hex,
        icon.background.fill.type === 'solid' ? firstColor.hex : darken(firstColor.hex, 0.35),
      );
      changes.push(`made the background ${firstColor.name} (emoji keep their own colors)`);
    } else if (mentionsBorder) {
      icon.background.border.color = firstColor.hex;
      if (icon.background.border.width === 0) icon.background.border.width = 0.04;
      changes.push(`made the border ${firstColor.name}`);
    } else if (secondColor) {
      repaintFill(icon.background.fill, firstColor.hex, secondColor.hex);
      if (icon.background.fill.type === 'solid') icon.background.fill.type = 'linear';
      changes.push(`used ${firstColor.name} and ${secondColor.name}`);
    } else {
      repaintFill(
        icon.background.fill,
        firstColor.hex,
        icon.background.fill.type === 'solid' ? firstColor.hex : darken(firstColor.hex, 0.35),
      );
      changes.push(`made it ${firstColor.name}`);
    }
  } else if (say(['darker', 'dark', 'deeper', 'moodier', 'dimmer'])) {
    shadeFill(icon.background.fill, (hex) => darken(hex, 0.25));
    changes.push('made it darker');
  } else if (say(['lighter', 'brighter', 'paler', 'softer'])) {
    shadeFill(icon.background.fill, (hex) => lighten(hex, 0.2));
    changes.push('made it lighter');
  }

  if (say(['swap', 'flip', 'invert', 'reverse'])) {
    const fill = icon.background.fill;
    [fill.color1, fill.color2] = [fill.color2, fill.color1];
    // Mirror the middles too, or an off-centre stop lands on the wrong side.
    for (const stop of fill.stops) stop.offset = 1 - stop.offset;
    changes.push('swapped the colors');
  }

  // Size, rotation, position
  if (say(['bigger', 'larger', 'big', 'huge', 'zoom', 'enlarge'])) {
    layer.transform.scale = clamp(layer.transform.scale + 0.15, RANGES.scale.min, RANGES.scale.max);
    changes.push('made the content bigger');
  } else if (say(['smaller', 'tiny', 'small', 'shrink', 'reduce'])) {
    layer.transform.scale = clamp(layer.transform.scale - 0.15, RANGES.scale.min, RANGES.scale.max);
    changes.push('made the content smaller');
  }
  if (say(['rotate', 'rotated', 'tilt', 'tilted', 'spin', 'angle'])) {
    const amount = tokens.map(Number).find((n) => Number.isFinite(n) && n !== 0) ?? 15;
    const direction = say(['left', 'counter', 'anticlockwise', 'counterclockwise']) ? -1 : 1;
    layer.transform.rotation = clamp(layer.transform.rotation + amount * direction, RANGES.rotation.min, RANGES.rotation.max);
    changes.push(`rotated it ${Math.round(amount)}°`);
  }
  if (say(['move', 'shift', 'nudge', 'push', 'slide'])) {
    const step = 0.08;
    if (say(['left'])) layer.transform.x = clamp(layer.transform.x - step, RANGES.offset.min, RANGES.offset.max);
    if (say(['right'])) layer.transform.x = clamp(layer.transform.x + step, RANGES.offset.min, RANGES.offset.max);
    if (say(['up', 'higher'])) layer.transform.y = clamp(layer.transform.y - step, RANGES.offset.min, RANGES.offset.max);
    if (say(['down', 'lower'])) layer.transform.y = clamp(layer.transform.y + step, RANGES.offset.min, RANGES.offset.max);
    changes.push('nudged the content');
  }
  if (say(['center', 'centre', 'centered', 'recenter'])) {
    layer.transform.x = 0;
    layer.transform.y = 0;
    layer.transform.rotation = 0;
    changes.push('centered the content');
  }

  // Effects
  // "Outline" means the plate's rim or a line round the mark, depending on
  // what the sentence is about. The parser sets the border flag from the same
  // words, so the two readings are separated here rather than by that flag.
  const outlineWords = say(['outline', 'outlined', 'stroke', 'edge']);
  const outlineTheMark = outlineWords && mentionsContent;
  if (outlineTheMark) {
    if (parsed.flags.border === false) {
      layer.effects.outline = null;
      changes.push('removed the outline');
    } else {
      layer.effects.outline = { width: 0.014, color: '#000000' };
      changes.push('outlined it');
    }
  } else if (parsed.flags.border === true) {
    if (say(['thicker', 'thick', 'bolder', 'wider'])) {
      icon.background.border.width = clamp(Math.max(icon.background.border.width, 0.03) + 0.02, 0, RANGES.borderWidth.max);
      changes.push('thickened the border');
    } else if (say(['thinner', 'thin', 'subtle', 'narrower'])) {
      icon.background.border.width = clamp(icon.background.border.width - 0.02, 0.01, RANGES.borderWidth.max);
      changes.push('thinned the border');
    } else if (icon.background.border.width === 0) {
      icon.background.border.width = 0.04;
      changes.push('added a border');
    }
  } else if (parsed.flags.border === false && icon.background.border.width > 0) {
    icon.background.border.width = 0;
    changes.push('removed the border');
  }
  if (parsed.flags.shadow !== undefined && parsed.flags.shadow !== icon.background.shadow.enabled) {
    icon.background.shadow.enabled = parsed.flags.shadow;
    changes.push(parsed.flags.shadow ? 'added a shadow' : 'removed the shadow');
  }
  if (say(['glow', 'glowing', 'neon'])) {
    icon.background.shadow = { enabled: true, blur: 0.08, opacity: 0.6, dx: 0, dy: 0, color: icon.background.fill.color1 };
    layer.effects.glow = { color: contentColorOf(layer.content) ?? '#ffffff', blur: 0.06, opacity: 0.75 };
    changes.push('added a glow');
  }
  if (parsed.flags.gloss !== undefined && parsed.flags.gloss !== icon.background.gloss) {
    icon.background.gloss = parsed.flags.gloss;
    changes.push(parsed.flags.gloss ? 'made it glossy' : 'made it flat');
  }
  if (parsed.flags.fill && parsed.flags.fill !== icon.background.fill.type) {
    icon.background.fill.type = parsed.flags.fill;
    if (parsed.flags.fill !== 'solid' && icon.background.fill.color1 === icon.background.fill.color2) {
      icon.background.fill.color2 = darken(icon.background.fill.color1, 0.35);
    }
    changes.push(parsed.flags.fill === 'solid' ? 'made the fill solid' : `switched to a ${parsed.flags.fill} gradient`);
  }

  // Shape
  if (parsed.shape && parsed.shape !== icon.background.shape) {
    icon.background.shape = parsed.shape;
    changes.push(parsed.shape === 'none' ? 'removed the background' : `changed the shape to a ${SHAPE_LABELS[parsed.shape].toLowerCase()}`);
  }

  // "Make it better": add the finishing touches it doesn't have yet
  if (say(POLISH_WORDS)) {
    const touches: string[] = [];
    if (icon.background.shape !== 'none') {
      if (icon.background.border.width === 0) {
        icon.background.border = { width: 0.04, color: foregroundFor(icon) };
        touches.push('a border');
      }
      if (icon.background.fill.type === 'solid') {
        icon.background.fill.type = 'linear';
        icon.background.fill.color2 = darken(icon.background.fill.color1, 0.35);
        icon.background.fill.angle = 135;
        touches.push('a gradient');
      }
      if (!icon.background.gloss) {
        icon.background.gloss = true;
        touches.push('a glossy highlight');
      }
      if (!icon.background.shadow.enabled) {
        icon.background.shadow.enabled = true;
        touches.push('a soft shadow');
      }
    }
    if ('shadow' in layer.content && !layer.content.shadow) {
      layer.content.shadow = true;
      touches.push('a content shadow');
    }
    changes.push(
      touches.length > 0
        ? `polished it with ${joinChanges(touches)}`
        : 'it already has all the finishing touches, so I left the look as is',
    );
  }

  // Content
  const picked = pickContent(parsed, layer.content);
  if (picked) {
    layer.content = picked.content;
    changes.push(`switched the icon to ${picked.label}`);
    const theme = parsed.themes[0]?.theme;
    if (theme && !parsed.emoji && !parsed.text) roleName = theme.label;
  }

  // "No emoji" / "use an emoji": swap between emoji art and drawn symbols
  if (parsed.flags.prefer === 'symbol' && layer.content.kind === 'emoji') {
    const symbol = EMOJI_TO_SYMBOL[layer.content.emoji] ?? parsed.themes[0]?.theme.symbols[0] ?? 'star';
    layer.content = { kind: 'symbol', symbol, color: foregroundFor(icon), shadow: layer.content.shadow };
    changes.push(`swapped the emoji for a drawn ${SYMBOLS[symbol].label.toLowerCase()}`);
  } else if (parsed.flags.prefer === 'emoji' && layer.content.kind === 'symbol') {
    const emoji = SYMBOL_TO_EMOJI[layer.content.symbol];
    layer.content = { kind: 'emoji', emoji, shadow: layer.content.shadow };
    changes.push(`swapped the symbol for ${emoji}`);
  }

  // Style words without explicit colors: apply the style's look
  const brightnessChanged = changes.some((c) => c === 'made it darker' || c === 'made it lighter');
  for (const style of parsed.styles) {
    if (style.id === 'dark' && brightnessChanged) continue;
    if (style.id === 'shiny' && parsed.flags.gloss !== undefined) continue;
    const palette = style.palettes?.[0];
    if (palette && !firstColor) {
      repaintFill(icon.background.fill, palette[0], palette[1]);
      if (icon.background.fill.type === 'solid') icon.background.fill.type = style.fillType ?? 'linear';
    }
    if (style.fillType) icon.background.fill.type = style.fillType;
    if (style.border !== undefined) icon.background.border.width = style.border ? Math.max(icon.background.border.width, 0.04) : 0;
    if (style.gloss !== undefined) icon.background.gloss = style.gloss;
    if (style.shadow !== undefined) icon.background.shadow.enabled = style.shadow;
    if (style.glow) {
      icon.background.shadow = { enabled: true, blur: 0.08, opacity: 0.6, dx: 0, dy: 0, color: icon.background.fill.color1 };
      layer.effects.glow = { color: contentColorOf(layer.content) ?? '#ffffff', blur: 0.06, opacity: 0.75 };
    }
    if (style.contentColor) setContentColor(layer.content, style.contentColor);
    if (style.font && layer.content.kind === 'text') layer.content.font = style.font;
    changes.push(`made it ${style.label}`);
  }

  if (changes.length === 0) return null;
  const unique = Array.from(new Set(changes));
  const result: Refinement = { icon: sanitizeIcon(icon), reply: `${capitalize(joinChanges(unique))}.` };
  if (roleName) result.roleName = roleName;
  return result;
}
