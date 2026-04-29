import type { RepositoryId } from '../../../domain/repository/repository';
import type { WorkspaceActions } from '../../application/ports';

async function post(
  repoId: RepositoryId,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/repositories/${encodeURIComponent(repoId)}/actions/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Action failed');
  }
}

export const httpWorkspaceActions: WorkspaceActions = {
  stageFile: (repoId: RepositoryId, path: string) => post(repoId, 'stage-file', { path }),
  unstageFile: (repoId: RepositoryId, path: string) => post(repoId, 'unstage-file', { path }),
  stageAllWorkingFiles: (repoId: RepositoryId) => post(repoId, 'stage-all-working-files', {}),
  unstageAllStagedFiles: (repoId: RepositoryId) => post(repoId, 'unstage-all-staged-files', {}),
  discardWorkingFile: (repoId: RepositoryId, path: string) =>
    post(repoId, 'discard-working-file', { path }),
  discardAllWorkingFiles: (repoId: RepositoryId) => post(repoId, 'discard-all-working-files', {}),
  stageHunk: (repoId: RepositoryId, path: string, hunkId: string) =>
    post(repoId, 'stage-hunk', { path, hunkId }),
  unstageHunk: (repoId: RepositoryId, path: string, hunkId: string) =>
    post(repoId, 'unstage-hunk', { path, hunkId }),
};
