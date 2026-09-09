import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { firstEmoji } from '../emoji/twemoji';
import { DEFAULT_ICON, fillOf } from '../model/defaults';
import { sanitizeIcon } from '../model/serialize';
import {
  FILL_TYPES,
  FONTS,
  MAX_LAYERS,
  SHAPES,
  SYMBOL_IDS,
  isValidFontName,
  type Content,
  type Fill,
  type FontId,
  type IconState,
  type LayerEffects,
} from '../model/types';

/**
 * Smart mode for the assistant: a Claude model turns any description into
 * icon designs. Runs server-side (Vercel function or the Vite dev server)
 * so the API key never reaches the browser. Without a key the app falls
 * back to the built-in engine.
 */

export type Env = Record<string, string | undefined>;

export const DEFAULT_MODEL = 'claude-opus-5';
export const MAX_PROMPT_LENGTH = 400;
export const MAX_IDEAS = 8;
export const RATE_LIMIT = { windowMs: 10 * 60_000, max: 20 };

const FONT_IDS = FONTS.map((f) => f.id) as [FontId, ...FontId[]];

/** A flat layer description: easier for the model than the app's nested union. */
const ModelLayerSchema = z.object({
  kind: z
    .enum(['emoji', 'text', 'symbol', 'shape', 'image', 'none'])
    .describe('use image only to keep a picture the user already uploaded, never to add one'),
  emoji: z.string().describe('exactly one Unicode emoji when kind is emoji, else empty'),
  text: z.string().describe('1-4 characters when kind is text, else empty'),
  font: z.enum(FONT_IDS),
  customFont: z
    .string()
    .describe('any Google Font family name to use instead of font, e.g. "Orbitron"; empty to use font'),
  symbol: z.enum(SYMBOL_IDS),
  color: z.string().describe('#rrggbb for text, symbols and shape layers; emoji keep their own colors'),
  color2: z.string().describe('#rrggbb second color for a shape layer gradient'),
  gradient: z.boolean().describe('shape layer only: blend color into color2 instead of a flat fill'),
  shape: z.enum(SHAPES).describe('shape layer only'),
  sides: z.number().describe('shape layer only: sides for polygon, points for burst'),
  scale: z.number().describe('0.2 to 1.5; 1 fills the plate'),
  x: z.number().describe('-0.5 to 0.5, right is positive'),
  y: z.number().describe('-0.5 to 0.5, down is positive'),
  rotation: z.number().describe('-180 to 180 degrees'),
  opacity: z.number().describe('0 to 1'),
  shadow: z.boolean().describe('soft drop shadow behind this layer'),
  clip: z.boolean().describe('keep this layer inside the background silhouette'),
  glowColor: z
    .string()
    .describe('#rrggbb halo around this layer, for a neon look; empty for no glow'),
  outlineColor: z
    .string()
    .describe('#rrggbb line traced around this layer, to lift it off a busy plate; empty for none'),
  tintColor: z
    .string()
    .describe('#rrggbb to recolor this layer, which is the only way to recolor an emoji; empty to keep its own colors'),
});
type ModelLayer = z.infer<typeof ModelLayerSchema>;

const ModelIconSchema = z.object({
  shape: z.enum(SHAPES),
  cornerRadius: z.number().describe('0 to 0.5; only used by roundedSquare'),
  sides: z.number().describe('3-12 sides for polygon, 3-24 points for burst'),
  innerRatio: z.number().describe('burst only: 0.2 to 0.95 spike depth'),
  shapeRotation: z.number().describe('-180 to 180 degrees; rotates the plate itself'),
  fillType: z.enum(FILL_TYPES),
  color1: z.string().describe('#rrggbb'),
  color2: z.string().describe('#rrggbb second gradient color; same as color1 for solid'),
  color3: z
    .string()
    .describe('#rrggbb optional third color, placed between color1 and color2; empty for a two-color blend'),
  angle: z.number().describe('gradient angle in degrees 0-360; 135 is a nice diagonal'),
  borderWidth: z.number().describe('0 for no border, 0.03-0.05 for a crisp outline'),
  borderColor: z.string().describe('#rrggbb'),
  shadow: z.boolean().describe('soft drop shadow behind the plate'),
  gloss: z.boolean().describe('glossy highlight on the top half'),
  layers: z
    .array(ModelLayerSchema)
    .describe('bottom to top; usually one, but stack more when the design calls for it'),
});
type ModelIcon = z.infer<typeof ModelIconSchema>;

const IdeasSchema = z.object({
  reply: z.string().describe('1-2 friendly sentences explaining the choices, no markdown'),
  ideas: z.array(
    z.object({
      caption: z.string().describe('at most 6 words, e.g. "Shield · crown · red gradient"'),
      roleName: z.string().describe('a short role label such as "Admin" or "Night Owl"'),
      roleColor: z.string().describe('#rrggbb Discord role color that fits the design'),
      icon: ModelIconSchema,
    }),
  ),
});

const TweakSchema = z.object({
  reply: z.string().describe('one sentence saying what changed, no markdown'),
  roleName: z.string().nullable().describe('a new role label only if the instruction implies one'),
  icon: ModelIconSchema,
});

const RequestSchema = z.object({
  mode: z.enum(['ideas', 'tweak']),
  prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
  count: z.number().int().min(1).max(MAX_IDEAS).optional(),
  variation: z.number().int().min(0).max(99).optional(),
  icon: z.unknown().optional(),
});

export const SYSTEM_PROMPT = `You design Discord role icons inside the "Role Icon Maker" web app. A role icon is a tiny square image shown next to a member's name at about 20 px, so designs must be bold and simple: a background plate, one or two marks stacked on it, strong contrast. You reply only with the structured data the app expects.

Design space:
- shape: circle, roundedSquare (cornerRadius 0.15-0.35), square, squircle, hexagon, shield, diamond, star, heart, badge (scalloped seal), none (transparent background, content only).
- fill: solid, linear (angle in degrees), radial or conic (a colour wheel sweep from the angle). Colors are #rrggbb hex, and color3 adds a third colour in the middle of the blend. Pick palettes that read well at 20 px.
- borderWidth 0 for none or 0.03-0.05 for a crisp outline; borderColor usually white or a tone from the fill family. shadow adds a soft drop shadow; gloss adds a glossy highlight.
- shape also accepts polygon (3-12 sides) and burst (3-24 points with an adjustable spike depth), and the plate can be rotated.
- layers: an ordered list drawn bottom to top over the plate. Each layer is an emoji (exactly one Unicode emoji, rendered as Twemoji), text (1-4 characters; fonts: inter = clean, rubik = rounded, bangers = comic, luckiest = playful, pressstart = pixel/retro, pacifico = script, blackops = military stencil, bebas = tall condensed, lobster = elegant script, or any Google Font by name in customFont), a symbol (drawn silhouette: crown, shield, star, heart, bolt, check, cross, gear, gem, sword, skull, note, code, flame, moon, paw, trophy, key) or a shape (a plate, ring or accent behind the main mark). Each layer has its own scale, x, y, rotation, opacity, shadow and clip.
- Most icons want ONE layer. Stack a second or third only when it genuinely helps, for example a pale shape behind a symbol, or a small mark above short text. Keep it readable at 20 px: never more than three layers, and never overlapping two detailed marks.
- color colors text, symbols and shape layers: white on dark fills, a dark tone on light fills. scale 0.9-1.2 is normal.
- Each layer can also carry effects, which work on any layer including emoji and pictures: glowColor for a neon halo, outlineColor for a line traced round the mark so it survives a busy plate, and tintColor to recolor the layer, which is the only way to recolor an emoji. Leave each one empty for no effect, and use at most one per layer; a glow plus an outline at 20 px turns to mud.
- Never put a shield on a shield shape, a star on a star shape, or a heart on a heart shape.
- roleColor: a Discord role color that matches the design, ideally one of #1abc9c #2ecc71 #3498db #9b59b6 #e91e63 #f1c40f #e67e22 #e74c3c #95a5a6 #607d8b #11806a #1f8b4c #206694 #71368a #ad1457 #c27c0e #a84300 #992d22 #979c9f #546e7a.

For an ideas request: return exactly the requested number of ideas, each meaningfully different (vary shape, content, palette and fill) and all faithful to the request. Interpret slang, typos, other languages and vague requests generously; if the request names an emoji, use it. Captions are at most 6 words; roleName is a short role label; reply is 1-2 friendly sentences explaining your choices.
For a tweak request: apply only what the instruction asks, keep everything else identical, and explain the change in one sentence. If the instruction cannot be done with this design space, say so in the reply and return the icon unchanged.`;

export function assistantStatus(env: Env): { enabled: boolean; model: string } {
  return { enabled: Boolean(env.ANTHROPIC_API_KEY), model: env.ASSISTANT_MODEL || DEFAULT_MODEL };
}

const buckets = new Map<string, number[]>();

/** Sliding-window limiter per caller; state is per server instance, which is fine for a hobby site. */
export function checkRateLimit(key: string, now = Date.now()): boolean {
  const cutoff = now - RATE_LIMIT.windowMs;
  const stamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (stamps.length >= RATE_LIMIT.max) {
    buckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  buckets.set(key, stamps);
  return true;
}

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (value: string, fallback: string) => (HEX.test(value) ? value.toLowerCase() : fallback);
/** A color the model may leave empty to mean "no effect". */
const optionalHex = (value: string | undefined): string | null =>
  typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : null;

/** Converts one flat layer description into validated layer content. */
function toContent(model: ModelLayer): Content {
  const shadow = Boolean(model.shadow);
  const color = hex(model.color, '#ffffff');
  switch (model.kind) {
    case 'emoji':
      return { kind: 'emoji', emoji: firstEmoji(model.emoji) ?? '\u{2B50}', shadow };
    case 'text':
      return {
        kind: 'text',
        text: Array.from(model.text.trim()).slice(0, 8).join('') || 'A',
        font: model.font,
        customFont: isValidFontName(model.customFont ?? '') ? model.customFont.trim() : null,
        weight: 900,
        color,
        letterSpacing: 0.02,
        stroke: null,
        shadow,
      };
    case 'symbol':
      return { kind: 'symbol', symbol: model.symbol, color, shadow };
    case 'image':
      // The model cannot invent image bytes; the caller restores them.
      return { kind: 'none' };
    case 'shape':
      return {
        kind: 'shape',
        shape: model.shape === 'none' ? 'circle' : model.shape,
        sides: Math.round(model.sides || 6),
        innerRatio: 0.62,
        rotation: 0,
        cornerRadius: 0.25,
        fill: fillOf({
          type: model.gradient ? 'linear' : 'solid',
          color1: color,
          color2: hex(model.color2, color),
          angle: 135,
        }),
        border: { width: 0, color: '#000000' },
        shadow,
      };
    default:
      return { kind: 'none' };
  }
}

/**
 * Effects for a layer the model answered with. The schema carries a color per
 * effect and nothing else, so the strengths the user tuned are kept from the
 * layer being edited instead of snapping back to the defaults on every tweak.
 */
function carriedEffects(layer: ModelLayer, previous: LayerEffects | undefined): LayerEffects {
  const glow = optionalHex(layer.glowColor);
  const outline = optionalHex(layer.outlineColor);
  const tint = optionalHex(layer.tintColor);
  return {
    glow: glow
      ? {
          color: glow,
          blur: previous?.glow?.blur ?? 0.06,
          opacity: previous?.glow?.opacity ?? 0.75,
        }
      : null,
    outline: outline ? { color: outline, width: previous?.outline?.width ?? 0.014 } : null,
    tint: tint ? { color: tint, amount: previous?.tint?.amount ?? 1 } : null,
  };
}

/**
 * The gradient detail the model's flat schema cannot carry. A tweak such as
 * "make it darker" would otherwise flatten a hand-tuned gradient back to two
 * colors, so the centre, the spread and any extra stops come from the icon the
 * user is editing. The model can still replace the middle color, and saying so
 * wins over what was there.
 */
function carriedFill(
  model: ModelIcon,
  previous: Fill | undefined,
): Pick<Fill, 'stops' | 'cx' | 'cy' | 'radius'> {
  const middle = optionalHex(model.color3);
  const kept = previous?.stops ?? [];
  const stops = middle
    ? kept.length > 0
      ? kept.map((stop, index) => (index === 0 ? { ...stop, color: middle } : { ...stop }))
      : [{ offset: 0.5, color: middle }]
    : [];
  return {
    stops,
    cx: previous?.cx ?? 0,
    cy: previous?.cy ?? 0,
    radius: previous?.radius ?? DEFAULT_ICON.background.fill.radius,
  };
}

/**
 * Converts the model's flat icon into a validated IconState. `previous` is the
 * icon the user is editing: an uploaded image cannot survive a round trip
 * through the model, so a layer the model returns as an image is refilled from
 * the matching layer of `previous` rather than being dropped.
 */
export function toIconState(model: ModelIcon, previous?: IconState): IconState {
  const spareImages = (previous?.layers ?? [])
    .map((l) => l.content)
    .filter((c): c is Extract<Content, { kind: 'image' }> => c.kind === 'image' && c.src !== null);
  let nextImage = 0;
  // Layers come back with fresh ids, so a mask carried over from the design
  // being edited has to be renamed to match, or it would point at nothing and
  // be dropped. Layers line up by position, which is how images carry too.
  const carriedMask = (index: number): string | null => {
    const was = previous?.layers[index]?.clipTo;
    if (!was) return null;
    const target = previous?.layers.findIndex((l) => l.id === was) ?? -1;
    return target >= 0 ? `m${target}` : null;
  };
  const layers = (model.layers ?? [])
    .slice(0, MAX_LAYERS)
    .map((layer, index) => ({
      id: `m${index}`,
      name: '',
      hidden: false,
      locked: false,
      content:
        layer.kind === 'image'
          ? (spareImages[nextImage++] ?? { kind: 'none' as const })
          : toContent(layer),
      transform: {
        scale: layer.scale,
        x: layer.x,
        y: layer.y,
        rotation: layer.rotation,
        opacity: layer.opacity,
        flipX: false,
        flipY: false,
      },
      // Blend mode and mask have no place in the flat schema, so they come
      // from the layer being edited rather than being reset on every tweak.
      blend: previous?.layers[index]?.blend ?? ('normal' as const),
      clip: layer.clip !== false,
      clipTo: carriedMask(index),
      effects: carriedEffects(layer, previous?.layers[index]?.effects),
    }))
    .filter((layer) => layer.content.kind !== 'none');

  return sanitizeIcon({
    v: 2,
    background: {
      shape: model.shape,
      cornerRadius: model.cornerRadius,
      sides: model.sides,
      innerRatio: model.innerRatio,
      rotation: model.shapeRotation,
      fill: fillOf({
        type: model.fillType,
        color1: hex(model.color1, DEFAULT_ICON.background.fill.color1),
        color2: hex(model.color2, hex(model.color1, DEFAULT_ICON.background.fill.color2)),
        angle: model.angle,
        ...carriedFill(model, previous?.background.fill),
      }),
      border: { width: model.borderWidth, color: hex(model.borderColor, '#ffffff') },
      shadow: { ...DEFAULT_ICON.background.shadow, enabled: Boolean(model.shadow) },
      gloss: Boolean(model.gloss),
    },
    layers,
  });
}

function toModelLayer(layer: IconState['layers'][number]): ModelLayer {
  const c = layer.content;
  return {
    kind: c.kind,
    emoji: c.kind === 'emoji' ? c.emoji : '',
    text: c.kind === 'text' ? c.text : '',
    font: c.kind === 'text' ? c.font : 'inter',
    customFont: c.kind === 'text' ? (c.customFont ?? '') : '',
    symbol: c.kind === 'symbol' ? c.symbol : 'star',
    color:
      c.kind === 'text' || c.kind === 'symbol'
        ? c.color
        : c.kind === 'shape'
          ? c.fill.color1
          : '#ffffff',
    color2: c.kind === 'shape' ? c.fill.color2 : '#ffffff',
    gradient: c.kind === 'shape' ? c.fill.type !== 'solid' : false,
    shape: c.kind === 'shape' ? c.shape : 'circle',
    sides: c.kind === 'shape' ? c.sides : 6,
    scale: layer.transform.scale,
    x: layer.transform.x,
    y: layer.transform.y,
    rotation: layer.transform.rotation,
    opacity: layer.transform.opacity,
    shadow: 'shadow' in c ? c.shadow : false,
    clip: layer.clip,
    glowColor: layer.effects.glow?.color ?? '',
    outlineColor: layer.effects.outline?.color ?? '',
    tintColor: layer.effects.tint?.color ?? '',
  };
}

/** The inverse of toIconState, so the model sees the schema it has to answer with. */
export function toModelIcon(icon: IconState): ModelIcon {
  const bg = icon.background;
  return {
    shape: bg.shape,
    cornerRadius: bg.cornerRadius,
    sides: bg.sides,
    innerRatio: bg.innerRatio,
    shapeRotation: bg.rotation,
    fillType: bg.fill.type,
    color1: bg.fill.color1,
    color2: bg.fill.color2,
    color3: bg.fill.stops[0]?.color ?? '',
    angle: bg.fill.angle,
    borderWidth: bg.border.width,
    borderColor: bg.border.color,
    shadow: bg.shadow.enabled,
    gloss: bg.gloss,
    layers: icon.layers.map(toModelLayer),
  };
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export interface RemoteIdea {
  id: string;
  caption: string;
  roleName: string | null;
  roleColor: string;
  icon: IconState;
}

function errorResult(status: number, error: string, message: string): HandlerResult {
  return { status, body: { error, message } };
}

/** Handles one POST body; framework-neutral so Vercel and the Vite dev server share it. */
export async function handleAssistantRequest(
  payload: unknown,
  context: { ip: string; env: Env },
): Promise<HandlerResult> {
  const request = RequestSchema.safeParse(payload);
  if (!request.success) {
    return errorResult(400, 'invalid_request', 'Send { mode, prompt } with a prompt of at most 400 characters.');
  }
  const { enabled, model } = assistantStatus(context.env);
  if (!enabled) {
    return errorResult(503, 'not_configured', 'Smart mode is off: no ANTHROPIC_API_KEY is configured on the server.');
  }
  if (!checkRateLimit(context.ip)) {
    return errorResult(429, 'rate_limited', 'Too many requests, try again in a few minutes.');
  }

  const client = new Anthropic({ apiKey: context.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 55_000 });
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  const { mode, prompt } = request.data;

  try {
    if (mode === 'ideas') {
      const count = request.data.count ?? 6;
      const variation = request.data.variation ?? 0;
      const userText =
        `Design ${count} role icon ideas for this request: "${prompt}"` +
        (variation > 0 ? `\n\nThis is round ${variation + 1}: propose directions that differ from the obvious first answer.` : '');
      const response = await client.messages.parse({
        model,
        max_tokens: 8000,
        system,
        messages: [{ role: 'user', content: userText }],
        output_config: { effort: 'medium', format: zodOutputFormat(IdeasSchema) },
      });
      if (response.stop_reason === 'refusal') {
        return errorResult(422, 'refused', 'The model declined this request.');
      }
      const parsed = response.parsed_output;
      if (!parsed) return errorResult(502, 'bad_output', 'The model returned no usable design.');
      const ideas: RemoteIdea[] = parsed.ideas.slice(0, count).map((idea, index) => ({
        id: `claude-${variation}-${index}`,
        caption: idea.caption.slice(0, 60),
        roleName: idea.roleName.trim().slice(0, 40) || null,
        roleColor: hex(idea.roleColor, '#3498db'),
        icon: toIconState(idea.icon),
      }));
      if (ideas.length === 0) return errorResult(502, 'bad_output', 'The model returned no ideas.');
      return { status: 200, body: { source: 'claude', model, reply: parsed.reply.trim(), ideas } };
    }

    const current = sanitizeIcon(request.data.icon);
    const response = await client.messages.parse({
      model,
      max_tokens: 4000,
      system,
      messages: [
        {
          role: 'user',
          content: `Current icon:\n${JSON.stringify(toModelIcon(current))}\n\nInstruction: "${prompt}"`,
        },
      ],
      output_config: { effort: 'medium', format: zodOutputFormat(TweakSchema) },
    });
    if (response.stop_reason === 'refusal') {
      return errorResult(422, 'refused', 'The model declined this request.');
    }
    const parsed = response.parsed_output;
    if (!parsed) return errorResult(502, 'bad_output', 'The model returned no usable design.');
    return {
      status: 200,
      body: {
        source: 'claude',
        model,
        reply: parsed.reply.trim(),
        roleName: parsed.roleName?.trim().slice(0, 40) || null,
        icon: toIconState(parsed.icon, current),
      },
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return errorResult(503, 'not_configured', 'The configured API key was rejected.');
    }
    if (error instanceof Anthropic.RateLimitError) {
      return errorResult(429, 'rate_limited', 'The model is busy, try again shortly.');
    }
    if (error instanceof Anthropic.APIError) {
      return errorResult(502, 'upstream_error', `Model request failed (${error.status ?? 'network'}).`);
    }
    return errorResult(500, 'internal', error instanceof Error ? error.message : 'Unknown error');
  }
}
