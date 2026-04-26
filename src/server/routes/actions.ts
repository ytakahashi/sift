import { Hono, type Context } from 'hono';
import type { Env } from '../create-app';
import type { RepositoryResolver } from '../services/repository-resolver';
import { handleRouteError } from './route-error';
import type { WorkspaceActionService } from '../services/workspace-action-service';

export interface CreateActionRoutesOptions {
  repositoryResolver: RepositoryResolver;
  createWorkspaceActionService: (repositoryPath: string) => WorkspaceActionService;
}

async function createScopedActionService(
  c: Context<Env>,
  resolver: RepositoryResolver,
  createService: (path: string) => WorkspaceActionService,
): Promise<WorkspaceActionService> {
  const repository = await resolver.resolve(c.req.param('repoId') as string);
  return createService(repository.path);
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
    return handleRouteError(c, error);
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

export function createActionRoutes(options: CreateActionRoutesOptions): Hono<Env> {
  const actionRoutes = new Hono<Env>();
  const resolver = options.repositoryResolver;
  const { createWorkspaceActionService } = options;

  registerActionRoutes(actionRoutes, '/repositories/:repoId/actions', (c) =>
    createScopedActionService(c, resolver, createWorkspaceActionService),
  );

  return actionRoutes;
}
