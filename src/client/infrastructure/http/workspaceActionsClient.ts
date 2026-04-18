import type { WorkspaceActions } from '../../application/ports';

async function post(endpoint: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/actions/${endpoint}`, {
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
  stageFile: (path: string) => post('stage-file', { path }),
  unstageFile: (path: string) => post('unstage-file', { path }),
  discardWorkingFile: (path: string) => post('discard-working-file', { path }),
  stageHunk: (path: string, hunkId: string) => post('stage-hunk', { path, hunkId }),
  unstageHunk: (path: string, hunkId: string) => post('unstage-hunk', { path, hunkId }),
};
