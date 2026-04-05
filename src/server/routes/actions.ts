import { Hono } from 'hono';
import type { Env } from '../create-app';
import { WorkspaceActionService } from '../services/workspace-action-service';

export const actionRoutes = new Hono<Env>();

actionRoutes.post('/stage-file', async (c) => {
  const body = await c.req.json();
  const service = new WorkspaceActionService(c.get('repoRoot'));
  try {
    await service.stageFile(body.path);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

actionRoutes.post('/unstage-file', async (c) => {
  const body = await c.req.json();
  const service = new WorkspaceActionService(c.get('repoRoot'));
  try {
    await service.unstageFile(body.path);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

actionRoutes.post('/stage-hunk', async (c) => {
  const body = await c.req.json();
  const service = new WorkspaceActionService(c.get('repoRoot'));
  try {
    await service.stageHunk(body.path, body.hunkId);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

actionRoutes.post('/unstage-hunk', async (c) => {
  const body = await c.req.json();
  const service = new WorkspaceActionService(c.get('repoRoot'));
  try {
    await service.unstageHunk(body.path, body.hunkId);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
