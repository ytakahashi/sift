import { sseRepositoryChangeSource } from '../infrastructure/event/repositoryChangeSource';
import { httpDiffReader } from '../infrastructure/http/diffClient';
import { httpSessionReader } from '../infrastructure/http/sessionClient';
import { httpWorkspaceActions } from '../infrastructure/http/workspaceActionsClient';
import type { AppDependencies } from './dependencies';

export function createClientDependencies(): AppDependencies {
  return {
    diffReader: httpDiffReader,
    sessionReader: httpSessionReader,
    workspaceActions: httpWorkspaceActions,
    repositoryChangeSource: sseRepositoryChangeSource,
  };
}
