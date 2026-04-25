import { Hono, type Context } from 'hono';
import type { Env } from '../create-app';
import {
  readRepositoryConfig,
  type RepositoryConfigReadResult,
} from '../infrastructure/config/repository-config-reader';
import {
  resolveScopedRepository,
  ScopedRepositoryResolutionError,
} from '../services/scoped-resolution';
import { getErrorMessage } from '../error/error-utils';
import type { RepositoryDescriptor } from '../../domain/repository/repository';
import { WorkspaceActionService } from '../services/workspace-action-service';

export interface CreateActionRoutesOptions {
  readConfig?: () => Promise<RepositoryConfigReadResult>;
}

function createWorkspaceActionService(repository: RepositoryDescriptor): WorkspaceActionService {
  return new WorkspaceActionService(repository.path);
}

async function createScopedActionService(
  c: Context<Env>,
  readConfig: () => Promise<RepositoryConfigReadResult>,
): Promise<WorkspaceActionService> {
  const configResult = await readConfig();
  const repository = resolveScopedRepository(configResult, c.req.param('repoId'));
  return createWorkspaceActionService(repository);
}

async function handleAction(
  c: Context<Env>,
  createService: () => Promise<WorkspaceActionService> | WorkspaceActionService,
  runAction: (service: WorkspaceActionService, body: Record<string, unknown>) => Promise<void>,
): Promise<Response> {
  const body = (await c.req.json()) as Record<string, unknown>;

  try {
    const service = await createService();
    await runAction(service, body);
    return c.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof ScopedRepositoryResolutionError) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ error: getErrorMessage(error) }, 500);
  }
}

function getPath(body: Record<string, unknown>): string {
  return String(body.path);
}

function getHunkId(body: Record<string, unknown>): string {
  return String(body.hunkId);
}

function registerActionRoutes(
  routes: Hono<Env>,
  basePath: string,
  createService: (c: Context<Env>) => Promise<WorkspaceActionService> | WorkspaceActionService,
): void {
  routes.post(`${basePath}/stage-file`, (c) =>
    handleAction(
      c,
      () => createService(c),
      async (service, body) => {
        await service.stageFile(getPath(body));
      },
    ),
  );

  routes.post(`${basePath}/unstage-file`, (c) =>
    handleAction(
      c,
      () => createService(c),
      async (service, body) => {
        await service.unstageFile(getPath(body));
      },
    ),
  );

  routes.post(`${basePath}/stage-hunk`, (c) =>
    handleAction(
      c,
      () => createService(c),
      async (service, body) => {
        await service.stageHunk(getPath(body), getHunkId(body));
      },
    ),
  );

  routes.post(`${basePath}/unstage-hunk`, (c) =>
    handleAction(
      c,
      () => createService(c),
      async (service, body) => {
        await service.unstageHunk(getPath(body), getHunkId(body));
      },
    ),
  );

  routes.post(`${basePath}/discard-working-file`, (c) =>
    handleAction(
      c,
      () => createService(c),
      async (service, body) => {
        await service.discardWorkingFile(getPath(body));
      },
    ),
  );
}

export function createActionRoutes(options: CreateActionRoutesOptions = {}): Hono<Env> {
  const actionRoutes = new Hono<Env>();
  const readConfig = options.readConfig ?? readRepositoryConfig;

  registerActionRoutes(actionRoutes, '/repositories/:repoId/actions', (c) =>
    createScopedActionService(c, readConfig),
  );

  return actionRoutes;
}
