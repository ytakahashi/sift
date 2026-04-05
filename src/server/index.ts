import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp, Env } from './create-app.js';
import { Hono } from 'hono';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared instance for Vite Dev server when running via `vite` CLI
const app = new Hono<Env>();

// Inject a default repo root for dev mode if not provided by CLI wrapper
app.use('*', async (c, next) => {
  if (!c.get('repoRoot')) {
    c.set('repoRoot', process.env.SIFT_REPO_ROOT || process.cwd());
  }
  await next();
});

app.route('/', createApp());

export default app;

// Function called by CLI
export async function startServer(repoRoot: string): Promise<string> {
  const cliApp = new Hono<Env>();

  // Inject the dynamically resolved repo root
  cliApp.use('*', async (c, next) => {
    c.set('repoRoot', repoRoot);
    await next();
  });

  // Mount the main app
  cliApp.route('/', createApp());

  // In production, try to serve built client files.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDir = path.resolve(__dirname, '../../dist/client');

  cliApp.use('/assets/*', serveStatic({ root: path.relative(process.cwd(), clientDir) }));
  
  cliApp.get('*', async (c) => {
    try {
      const { readFile } = await import('node:fs/promises');
      const html = await readFile(path.join(clientDir, 'index.html'), 'utf-8');
      return c.html(html);
    } catch {
      return c.text('Not Found', 404);
    }
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  return new Promise((resolve) => {
    serve({
      fetch: cliApp.fetch,
      port,
    }, (info) => {
      resolve(`http://localhost:${info.port}`);
    });
  });
}
