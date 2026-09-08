import { cloneIcon } from '../model/defaults';
import { randomizeIcon } from '../model/random';
import { sanitizeIcon } from '../model/serialize';
import { RANGES, SHAPE_LABELS, type Content, type IconState } from '../model/types';
import { darken, lighten } from '../render/color';
import { SYMBOLS } from '../render/symbols';
import { findKeyword, isNegated, parsePrompt, type ParsedPrompt } from './parse';

export interface Refinement {
  icon: IconState;
  reply: string;
  roleName?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function has(tokens: readonly string[], words: readonly string[]): boolean {
  return words.some((word) => {
    const index = findKeyword(tokens, word);
    return index >= 0 && !isNegated(tokens, index);
  });
}

function joinChanges(changes: readonly string[]): string {
  if (changes.length === 0) return '';
  if (changes.length === 1) return changes[0] ?? '';
  return `${changes.slice(0, -1).join(', ')} and ${changes[changes.length - 1] ?? ''}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
        : { kind: 'text' as const, text: '', font: 'inter' as const, weight: 900 as const, color: '#ffffff', letterSpacing: 0.02, stroke: null, shadow: false };
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
  const { tokens } = parsed;
  const icon = cloneIcon(current);
  const changes: string[] = [];
  let roleName: string | undefined;

  if (has(tokens, ['random', 'surprise', 'shuffle', 'reroll', 'something else', 'anything'])) {
    return { icon: randomizeIcon(), reply: 'Rolled a fresh random design.' };
  }

  // Colors and brightness
  const mentionsContent = has(tokens, ['icon', 'symbol', 'text', 'letters', 'letter', 'glyph', 'content', 'foreground']);
  const mentionsBorder = has(tokens, ['border', 'outline', 'ring']);
  const firstColor = parsed.colors[0];
  const secondColor = parsed.colors[1];
  if (parsed.contentColor) {
    if (setContentColor(icon.content, parsed.contentColor.hex)) {
      changes.push(`colored the ${icon.content.kind} ${parsed.contentColor.name}`);
    } else {
      icon.border.color = parsed.contentColor.hex;
      changes.push(`used ${parsed.contentColor.name} for the border (emoji keep their own colors)`);
    }
  }
  if (firstColor) {
    if (mentionsContent && setContentColor(icon.content, firstColor.hex)) {
      changes.push(`colored the ${icon.content.kind} ${firstColor.name}`);
    } else if (mentionsContent && !mentionsBorder) {
      icon.fill.color1 = firstColor.hex;
      icon.fill.color2 = icon.fill.type === 'solid' ? firstColor.hex : darken(firstColor.hex, 0.35);
      changes.push(`made the background ${firstColor.name} (emoji keep their own colors)`);
    } else if (mentionsBorder) {
      icon.border.color = firstColor.hex;
      if (icon.border.width === 0) icon.border.width = 0.04;
      changes.push(`made the border ${firstColor.name}`);
    } else if (secondColor) {
      icon.fill.color1 = firstColor.hex;
      icon.fill.color2 = secondColor.hex;
      if (icon.fill.type === 'solid') icon.fill.type = 'linear';
      changes.push(`used ${firstColor.name} and ${secondColor.name}`);
    } else {
      icon.fill.color1 = firstColor.hex;
      icon.fill.color2 = icon.fill.type === 'solid' ? firstColor.hex : darken(firstColor.hex, 0.35);
      changes.push(`made it ${firstColor.name}`);
    }
  } else if (has(tokens, ['darker', 'dark', 'deeper', 'moodier', 'dimmer'])) {
    icon.fill.color1 = darken(icon.fill.color1, 0.25);
    icon.fill.color2 = darken(icon.fill.color2, 0.25);
    changes.push('made it darker');
  } else if (has(tokens, ['lighter', 'brighter', 'paler', 'softer'])) {
    icon.fill.color1 = lighten(icon.fill.color1, 0.2);
    icon.fill.color2 = lighten(icon.fill.color2, 0.2);
    changes.push('made it lighter');
  }

  if (has(tokens, ['swap', 'flip', 'invert', 'reverse'])) {
    [icon.fill.color1, icon.fill.color2] = [icon.fill.color2, icon.fill.color1];
    changes.push('swapped the colors');
  }

  // Size, rotation, position
  if (has(tokens, ['bigger', 'larger', 'big', 'huge', 'zoom', 'enlarge'])) {
    icon.transform.scale = clamp(icon.transform.scale + 0.15, RANGES.scale.min, RANGES.scale.max);
    changes.push('made the content bigger');
  } else if (has(tokens, ['smaller', 'tiny', 'small', 'shrink', 'reduce'])) {
    icon.transform.scale = clamp(icon.transform.scale - 0.15, RANGES.scale.min, RANGES.scale.max);
    changes.push('made the content smaller');
  }
  if (has(tokens, ['rotate', 'rotated', 'tilt', 'tilted', 'spin', 'angle'])) {
    const amount = tokens.map(Number).find((n) => Number.isFinite(n) && n !== 0) ?? 15;
    const direction = has(tokens, ['left', 'counter', 'anticlockwise', 'counterclockwise']) ? -1 : 1;
    icon.transform.rotation = clamp(icon.transform.rotation + amount * direction, RANGES.rotation.min, RANGES.rotation.max);
    changes.push(`rotated it ${Math.round(amount)}°`);
  }
  if (has(tokens, ['move', 'shift', 'nudge', 'push', 'slide'])) {
    const step = 0.08;
    if (has(tokens, ['left'])) icon.transform.x = clamp(icon.transform.x - step, RANGES.offset.min, RANGES.offset.max);
    if (has(tokens, ['right'])) icon.transform.x = clamp(icon.transform.x + step, RANGES.offset.min, RANGES.offset.max);
    if (has(tokens, ['up', 'higher'])) icon.transform.y = clamp(icon.transform.y - step, RANGES.offset.min, RANGES.offset.max);
    if (has(tokens, ['down', 'lower'])) icon.transform.y = clamp(icon.transform.y + step, RANGES.offset.min, RANGES.offset.max);
    changes.push('nudged the content');
  }
  if (has(tokens, ['center', 'centre', 'centered', 'recenter'])) {
    icon.transform.x = 0;
    icon.transform.y = 0;
    icon.transform.rotation = 0;
    changes.push('centered the content');
  }

  // Effects
  if (parsed.flags.border === true) {
    if (has(tokens, ['thicker', 'thick', 'bolder', 'wider'])) {
      icon.border.width = clamp(Math.max(icon.border.width, 0.03) + 0.02, 0, RANGES.borderWidth.max);
      changes.push('thickened the border');
    } else if (has(tokens, ['thinner', 'thin', 'subtle', 'narrower'])) {
      icon.border.width = clamp(icon.border.width - 0.02, 0.01, RANGES.borderWidth.max);
      changes.push('thinned the border');
    } else if (icon.border.width === 0) {
      icon.border.width = 0.04;
      changes.push('added a border');
    }
  } else if (parsed.flags.border === false && icon.border.width > 0) {
    icon.border.width = 0;
    changes.push('removed the border');
  }
  if (parsed.flags.shadow !== undefined && parsed.flags.shadow !== icon.shadow.enabled) {
    icon.shadow.enabled = parsed.flags.shadow;
    changes.push(parsed.flags.shadow ? 'added a shadow' : 'removed the shadow');
  }
  if (has(tokens, ['glow', 'glowing', 'neon'])) {
    icon.shadow = { enabled: true, blur: 0.08, opacity: 0.6, dx: 0, dy: 0, color: icon.fill.color1 };
    changes.push('added a glow');
  }
  if (parsed.flags.gloss !== undefined && parsed.flags.gloss !== icon.gloss) {
    icon.gloss = parsed.flags.gloss;
    changes.push(parsed.flags.gloss ? 'made it glossy' : 'made it flat');
  }
  if (parsed.flags.fill && parsed.flags.fill !== icon.fill.type) {
    icon.fill.type = parsed.flags.fill;
    if (parsed.flags.fill !== 'solid' && icon.fill.color1 === icon.fill.color2) {
      icon.fill.color2 = darken(icon.fill.color1, 0.35);
    }
    changes.push(parsed.flags.fill === 'solid' ? 'made the fill solid' : `switched to a ${parsed.flags.fill} gradient`);
  }

  // Shape
  if (parsed.shape && parsed.shape !== icon.shape) {
    icon.shape = parsed.shape;
    changes.push(parsed.shape === 'none' ? 'removed the background' : `changed the shape to a ${SHAPE_LABELS[parsed.shape].toLowerCase()}`);
  }

  // Content
  const picked = pickContent(parsed, icon.content);
  if (picked) {
    icon.content = picked.content;
    changes.push(`switched the icon to ${picked.label}`);
    const theme = parsed.themes[0]?.theme;
    if (theme && !parsed.emoji && !parsed.text) roleName = theme.label;
  }

  // Style words without explicit colors: apply the style's look
  const brightnessChanged = changes.some((c) => c === 'made it darker' || c === 'made it lighter');
  for (const style of parsed.styles) {
    if (style.id === 'dark' && brightnessChanged) continue;
    if (style.id === 'shiny' && parsed.flags.gloss !== undefined) continue;
    const palette = style.palettes?.[0];
    if (palette && !firstColor) {
      [icon.fill.color1, icon.fill.color2] = palette;
      if (icon.fill.type === 'solid') icon.fill.type = style.fillType ?? 'linear';
    }
    if (style.fillType) icon.fill.type = style.fillType;
    if (style.border !== undefined) icon.border.width = style.border ? Math.max(icon.border.width, 0.04) : 0;
    if (style.gloss !== undefined) icon.gloss = style.gloss;
    if (style.shadow !== undefined) icon.shadow.enabled = style.shadow;
    if (style.glow) icon.shadow = { enabled: true, blur: 0.08, opacity: 0.6, dx: 0, dy: 0, color: icon.fill.color1 };
    if (style.contentColor) setContentColor(icon.content, style.contentColor);
    if (style.font && icon.content.kind === 'text') icon.content.font = style.font;
    changes.push(`made it ${style.label}`);
  }

  if (changes.length === 0) return null;
  const unique = Array.from(new Set(changes));
  const result: Refinement = { icon: sanitizeIcon(icon), reply: `${capitalize(joinChanges(unique))}.` };
  if (roleName) result.roleName = roleName;
  return result;
}
