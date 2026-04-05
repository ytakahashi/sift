import { Hono } from 'hono';
import type { Env } from '../create-app.js';
import { RepositoryDiffProvider } from '../../domain/diff/providers/repository-diff-provider.js';

export const diffRoutes = new Hono<Env>();

diffRoutes.get('/', async (c) => {
  const repoRoot = c.get('repoRoot');

  const provider = new RepositoryDiffProvider(repoRoot);

  try {
    const [workingFiles, stagedFiles] = await Promise.all([
      provider.getFiles('working'),
      provider.getFiles('staged'),
    ]);

    return c.json({
      workingFiles,
      stagedFiles,
      metadata: {
        repoRoot,
        revision: 'HEAD',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return c.json({ error: msg }, 500);
  }
});
