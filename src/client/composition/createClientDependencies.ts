import { sseRepositoryChangeSource } from '../infrastructure/event/repositoryChangeSource';
import { httpDiffReader } from '../infrastructure/http/diffClient';
import { httpRepositoryReader } from '../infrastructure/http/repositoryClient';
import { httpSessionReader } from '../infrastructure/http/sessionClient';
import { httpWorkspaceActions } from '../infrastructure/http/workspaceActionsClient';
import type { AppDependencies } from './dependencies';

export function createClientDependencies(): AppDependencies {
  return {
    diffReader: httpDiffReader,
    repositoryReader: httpRepositoryReader,
    sessionReader: httpSessionReader,
    workspaceActions: httpWorkspaceActions,
    repositoryChangeSource: sseRepositoryChangeSource,
  };
}
