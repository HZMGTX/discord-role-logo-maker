import { sanitizeIcon } from '../model/serialize';
import type { IconState } from '../model/types';
import type { Idea } from './generate';
import type { Refinement } from './refine';

/** Browser side of smart mode: talks to /api/assistant, which holds the API key. */

export interface RemoteStatus {
  enabled: boolean;
  model?: string;
}

export class RemoteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

const ENDPOINT = '/api/assistant';
const TIMEOUT_MS = 60_000;
let statusCache: Promise<RemoteStatus> | null = null;

/** Whether the server has smart mode configured. Cached for the session. */
export function remoteStatus(): Promise<RemoteStatus> {
  statusCache ??= fetch(ENDPOINT)
    .then(async (response) => {
      if (!response.ok) return { enabled: false };
      const data = (await response.json()) as Partial<RemoteStatus>;
      return { enabled: data.enabled === true, model: typeof data.model === 'string' ? data.model : undefined };
    })
    .catch(() => ({ enabled: false }));
  return statusCache;
}

async function post(body: unknown): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const code = typeof data.error === 'string' ? data.error : 'http_error';
      const message = typeof data.message === 'string' ? data.message : `Request failed (${response.status})`;
      throw new RemoteError(message, response.status, code);
    }
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export async function remoteIdeas(
  prompt: string,
  count: number,
  variation: number,
): Promise<{ reply: string; ideas: Idea[]; model: string }> {
  const data = await post({ mode: 'ideas', prompt, count, variation });
  const rawIdeas = Array.isArray(data.ideas) ? (data.ideas as Array<Record<string, unknown>>) : [];
  const ideas: Idea[] = rawIdeas.map((raw, index) => ({
    id: asString(raw.id, `claude-${variation}-${index}`),
    icon: sanitizeIcon(raw.icon),
    roleName: typeof raw.roleName === 'string' && raw.roleName ? raw.roleName : null,
    roleColor: /^#[0-9a-f]{6}$/i.test(asString(raw.roleColor, '')) ? asString(raw.roleColor, '') : '#3498db',
    caption: asString(raw.caption, 'Idea'),
  }));
  if (ideas.length === 0) throw new RemoteError('No ideas came back.', 502, 'bad_output');
  return { reply: asString(data.reply, 'Here are some ideas.'), ideas, model: asString(data.model, 'claude') };
}

export async function remoteTweak(
  icon: IconState,
  prompt: string,
): Promise<Refinement & { model: string }> {
  const data = await post({ mode: 'tweak', prompt, icon });
  const result: Refinement & { model: string } = {
    icon: sanitizeIcon(data.icon),
    reply: asString(data.reply, 'Done.'),
    model: asString(data.model, 'claude'),
  };
  if (typeof data.roleName === 'string' && data.roleName) result.roleName = data.roleName;
  return result;
}
