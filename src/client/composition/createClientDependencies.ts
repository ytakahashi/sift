import { sseRepositoryChangeSource } from '../infrastructure/event/repositoryChangeSource';
import { httpBlobContentReader } from '../infrastructure/http/blobContentClient';
import { httpDiffReader } from '../infrastructure/http/diffClient';
import { httpFileContentReader } from '../infrastructure/http/fileContentClient';
import { httpNotesGateway } from '../infrastructure/http/notesClient';
import {
  httpRepositoryReader,
  httpRepositoryWriter,
} from '../infrastructure/http/repositoryClient';
import { httpWorkspaceActions } from '../infrastructure/http/workspaceActionsClient';
import { detectPlatform } from '../infrastructure/platform/detectPlatform';
import type { AppDependencies } from './dependencies';

export function createClientDependencies(): AppDependencies {
  return {
    keyboardPlatform: detectPlatform(navigator),
    blobContentReader: httpBlobContentReader,
    diffReader: httpDiffReader,
    fileContentReader: httpFileContentReader,
    repositoryReader: httpRepositoryReader,
    repositoryWriter: httpRepositoryWriter,
    workspaceActions: httpWorkspaceActions,
    notesGateway: httpNotesGateway,
    repositoryChangeSource: sseRepositoryChangeSource,
  };
}
