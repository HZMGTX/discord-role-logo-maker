import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { firstEmoji } from '../emoji/twemoji';
import { DEFAULT_ICON } from '../model/defaults';
import { sanitizeIcon } from '../model/serialize';
import {
  FILL_TYPES,
  FONTS,
  SHAPES,
  SYMBOL_IDS,
  type Content,
  type FontId,
  type IconState,
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

/** A flat icon description: easier for the model than the app's nested union. */
const ModelIconSchema = z.object({
  shape: z.enum(SHAPES),
  cornerRadius: z.number().describe('0 to 0.5; only used by roundedSquare'),
  fillType: z.enum(FILL_TYPES),
  color1: z.string().describe('#rrggbb'),
  color2: z.string().describe('#rrggbb second gradient color; same as color1 for solid'),
  angle: z.number().describe('gradient angle in degrees 0-360; 135 is a nice diagonal'),
  borderWidth: z.number().describe('0 for no border, 0.03-0.05 for a crisp outline'),
  borderColor: z.string().describe('#rrggbb'),
  shadow: z.boolean().describe('soft drop shadow behind the shape'),
  gloss: z.boolean().describe('glossy highlight on the top half'),
  contentKind: z.enum(['emoji', 'text', 'symbol', 'none']),
  emoji: z.string().describe('exactly one Unicode emoji when contentKind is emoji, else empty'),
  text: z.string().describe('1-4 characters when contentKind is text, else empty'),
  font: z.enum(FONT_IDS),
  symbol: z.enum(SYMBOL_IDS),
  contentColor: z.string().describe('#rrggbb for text and symbols; emoji keep their own colors'),
  contentShadow: z.boolean(),
  scale: z.number().describe('content size, 0.9-1.2 is normal'),
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

export const SYSTEM_PROMPT = `You design Discord role icons inside the "Role Icon Maker" web app. A role icon is a tiny square image shown next to a member's name at about 20 px, so designs must be bold and simple: one background shape, one piece of content, strong contrast. You reply only with the structured data the app expects.

Design space:
- shape: circle, roundedSquare (cornerRadius 0.15-0.35), square, squircle, hexagon, shield, diamond, star, heart, badge (scalloped seal), none (transparent background, content only).
- fill: solid, linear (angle in degrees) or radial; colors are #rrggbb hex. Pick palettes that read well at 20 px.
- borderWidth 0 for none or 0.03-0.05 for a crisp outline; borderColor usually white or a tone from the fill family. shadow adds a soft drop shadow; gloss adds a glossy highlight.
- content: emoji (exactly one Unicode emoji, rendered as Twemoji), text (1-4 characters: initials or a very short word; fonts: inter = clean, rubik = rounded, bangers = comic, luckiest = playful, pressstart = pixel/retro, pacifico = script, blackops = military stencil, bebas = tall condensed, lobster = elegant script), symbol (drawn silhouette: crown, shield, star, heart, bolt, check, cross, gear, gem, sword, skull, note, code, flame, moon, paw, trophy, key) or none.
- contentColor colors text and symbols: white on dark fills, a dark tone on light fills. scale 0.9-1.2 is normal.
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

/** Converts the model's flat icon into a validated IconState. */
export function toIconState(model: ModelIcon): IconState {
  const shadow = Boolean(model.contentShadow);
  let content: Content;
  switch (model.contentKind) {
    case 'emoji':
      content = { kind: 'emoji', emoji: firstEmoji(model.emoji) ?? '⭐', shadow };
      break;
    case 'text':
      content = {
        kind: 'text',
        text: Array.from(model.text.trim()).slice(0, 8).join('') || 'A',
        font: model.font,
        weight: 900,
        color: hex(model.contentColor, '#ffffff'),
        letterSpacing: 0.02,
        stroke: null,
        shadow,
      };
      break;
    case 'symbol':
      content = { kind: 'symbol', symbol: model.symbol, color: hex(model.contentColor, '#ffffff'), shadow };
      break;
    default:
      content = { kind: 'none' };
  }
  return sanitizeIcon({
    v: 1,
    shape: model.shape,
    cornerRadius: model.cornerRadius,
    fill: {
      type: model.fillType,
      color1: hex(model.color1, DEFAULT_ICON.fill.color1),
      color2: hex(model.color2, hex(model.color1, DEFAULT_ICON.fill.color2)),
      angle: model.angle,
    },
    border: { width: model.borderWidth, color: hex(model.borderColor, '#ffffff') },
    shadow: { ...DEFAULT_ICON.shadow, enabled: Boolean(model.shadow) },
    gloss: Boolean(model.gloss),
    content,
    transform: { ...DEFAULT_ICON.transform, scale: model.scale },
  });
}

/** The inverse of toIconState, so the model sees the schema it has to answer with. */
export function toModelIcon(icon: IconState): ModelIcon {
  const c = icon.content;
  return {
    shape: icon.shape,
    cornerRadius: icon.cornerRadius,
    fillType: icon.fill.type,
    color1: icon.fill.color1,
    color2: icon.fill.color2,
    angle: icon.fill.angle,
    borderWidth: icon.border.width,
    borderColor: icon.border.color,
    shadow: icon.shadow.enabled,
    gloss: icon.gloss,
    contentKind: c.kind === 'image' ? 'none' : c.kind,
    emoji: c.kind === 'emoji' ? c.emoji : '',
    text: c.kind === 'text' ? c.text : '',
    font: c.kind === 'text' ? c.font : 'inter',
    symbol: c.kind === 'symbol' ? c.symbol : 'star',
    contentColor: c.kind === 'text' || c.kind === 'symbol' ? c.color : '#ffffff',
    contentShadow: 'shadow' in c ? c.shadow : false,
    scale: icon.transform.scale,
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
        icon: toIconState(parsed.icon),
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
