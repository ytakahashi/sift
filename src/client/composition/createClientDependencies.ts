import { sseRepositoryChangeSource } from '../infrastructure/event/repositoryChangeSource';
import { httpDiffReader } from '../infrastructure/http/diffClient';
import { httpFileContentReader } from '../infrastructure/http/fileContentClient';
import { httpNotesGateway } from '../infrastructure/http/notesClient';
import {
  httpRepositoryReader,
  httpRepositoryWriter,
} from '../infrastructure/http/repositoryClient';
import { httpWorkspaceActions } from '../infrastructure/http/workspaceActionsClient';
import type { AppDependencies } from './dependencies';

export function createClientDependencies(): AppDependencies {
  return {
    diffReader: httpDiffReader,
    fileContentReader: httpFileContentReader,
    repositoryReader: httpRepositoryReader,
    repositoryWriter: httpRepositoryWriter,
    workspaceActions: httpWorkspaceActions,
    notesGateway: httpNotesGateway,
    repositoryChangeSource: sseRepositoryChangeSource,
  };
}
