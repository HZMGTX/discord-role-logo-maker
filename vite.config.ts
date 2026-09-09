import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Serves /api/assistant in `vite dev`, mirroring the Vercel function in api/assistant.ts. */
function assistantDevApi(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'assistant-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/assistant', (req: IncomingMessage, res: ServerResponse) => {
        void (async () => {
          const mod = (await server.ssrLoadModule('/src/server/assistant.ts')) as typeof import('./src/server/assistant');
          if (req.method === 'GET') {
            sendJson(res, 200, mod.assistantStatus(env));
            return;
          }
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method_not_allowed' });
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          let payload: unknown;
          try {
            payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            sendJson(res, 400, { error: 'invalid_json', message: 'Body must be JSON.' });
            return;
          }
          const result = await mod.handleAssistantRequest(payload, { ip: req.socket.remoteAddress ?? 'local', env });
          sendJson(res, result.status, result.body);
        })().catch((error: unknown) => {
          sendJson(res, 500, { error: 'internal', message: error instanceof Error ? error.message : String(error) });
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  return {
    plugins: [react(), assistantDevApi(env)],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
