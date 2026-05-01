import { Hono, type Context } from 'hono';
import type { Env } from '../create-app';
import type { RepositoryResolver } from '../services/repository-resolver';
import { handleRouteError } from './route-error';
import type { WorkspaceActionService } from '../services/workspace-action-service';

export interface CreateActionRoutesOptions {
  repositoryResolver: RepositoryResolver;
  createWorkspaceActionService: (repositoryPath: string) => WorkspaceActionService;
}

class ActionParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionParameterError';
  }
}

async function createScopedActionService(
  c: Context<Env>,
  resolver: RepositoryResolver,
  createService: (path: string) => WorkspaceActionService,
): Promise<WorkspaceActionService> {
  const repository = await resolver.resolveRepository(c.req.param('repoId') as string);
  return createService(repository.path);
}

async function handleAction(
  c: Context<Env>,
  createService: () => Promise<WorkspaceActionService> | WorkspaceActionService,
  runAction: (service: WorkspaceActionService, body: Record<string, unknown>) => Promise<void>,
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch (_error: unknown) {
      return c.json({ error: 'Action request body must be a JSON object.' }, 400);
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return c.json({ error: 'Action request body must be a JSON object.' }, 400);
    }

    const service = await createService();
    await runAction(service, body as Record<string, unknown>);
    return c.body(null, 204);
  } catch (error: unknown) {
    if (error instanceof ActionParameterError) {
      return c.json({ error: error.message }, 400);
    }
    return handleRouteError(c, error);
  }
}

function getPath(body: Record<string, unknown>): string {
  const path = body.path;
  if (typeof path !== 'string' || path.trim() === '') {
    throw new ActionParameterError('Action requires a non-empty string path parameter.');
  }
  return path;
}

function getHunkId(body: Record<string, unknown>): string {
  const hunkId = body.hunkId;
  if (typeof hunkId !== 'string' || hunkId.trim() === '') {
    throw new ActionParameterError('Action requires a non-empty string hunkId parameter.');
  }
  return hunkId;
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

  routes.post(`${basePath}/stage-all-working-files`, (c) =>
    handleAction(
      c,
      () => createService(c),
      async (service, _body) => {
        await service.stageAllWorkingFiles();
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

  routes.post(`${basePath}/unstage-all-staged-files`, (c) =>
    handleAction(
      c,
      () => createService(c),
      async (service, _body) => {
        await service.unstageAllStagedFiles();
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

  routes.post(`${basePath}/discard-all-working-files`, (c) =>
    handleAction(
      c,
      () => createService(c),
      async (service, _body) => {
        await service.discardAllWorkingFiles();
      },
    ),
  );
}

export function createActionRoutes(options: CreateActionRoutesOptions): Hono<Env> {
  const actionRoutes = new Hono<Env>();
  const resolver = options.repositoryResolver;
  const { createWorkspaceActionService } = options;

  registerActionRoutes(actionRoutes, '/repositories/:repoId/actions', (c) =>
    createScopedActionService(c, resolver, createWorkspaceActionService),
  );

  return actionRoutes;
}
