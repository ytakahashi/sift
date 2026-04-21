import { sseRepositoryChangeSource } from '../infrastructure/event/repositoryChangeSource';
import { httpDiffReader } from '../infrastructure/http/diffClient';
import { httpRepositoryReader } from '../infrastructure/http/repositoryClient';
import { httpWorkspaceActions } from '../infrastructure/http/workspaceActionsClient';
import type { AppDependencies } from './dependencies';

export function createClientDependencies(): AppDependencies {
  return {
    diffReader: httpDiffReader,
    repositoryReader: httpRepositoryReader,
    workspaceActions: httpWorkspaceActions,
    repositoryChangeSource: sseRepositoryChangeSource,
  };
}
