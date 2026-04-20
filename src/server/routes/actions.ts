import { Hono, type Context } from 'hono';
import type { Env } from '../create-app';
import { WorkspaceActionService } from '../services/workspace-action-service';

export const actionRoutes = new Hono<Env>();

function createWorkspaceActionService(c: Context<Env>): WorkspaceActionService {
  return new WorkspaceActionService(c.get('repository').path);
}

actionRoutes.post('/stage-file', async (c) => {
  const body = await c.req.json();
  const service = createWorkspaceActionService(c);
  try {
    await service.stageFile(body.path);
    return c.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

actionRoutes.post('/unstage-file', async (c) => {
  const body = await c.req.json();
  const service = createWorkspaceActionService(c);
  try {
    await service.unstageFile(body.path);
    return c.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

actionRoutes.post('/stage-hunk', async (c) => {
  const body = await c.req.json();
  const service = createWorkspaceActionService(c);
  try {
    await service.stageHunk(body.path, body.hunkId);
    return c.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

actionRoutes.post('/unstage-hunk', async (c) => {
  const body = await c.req.json();
  const service = createWorkspaceActionService(c);
  try {
    await service.unstageHunk(body.path, body.hunkId);
    return c.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

actionRoutes.post('/discard-working-file', async (c) => {
  const body = await c.req.json();
  const service = createWorkspaceActionService(c);
  try {
    await service.discardWorkingFile(body.path);
    return c.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});
