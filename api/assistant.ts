import { assistantStatus, handleAssistantRequest } from '../src/server/assistant';

/** Vercel function: GET reports whether smart mode is on, POST designs or tweaks icons. */

export function GET(): Response {
  return Response.json(assistantStatus(process.env));
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json', message: 'Body must be JSON.' }, { status: 400 });
  }
  const result = await handleAssistantRequest(payload, { ip, env: process.env });
  return Response.json(result.body, { status: result.status });
}
