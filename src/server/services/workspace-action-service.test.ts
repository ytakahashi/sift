import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
import { WorkspaceActionService } from './workspace-action-service';

function createWorkingFile(path: string, status: DiffFile['status'], oldPath?: string): DiffFile {
  return {
    id: `file-${path}`,
    bucket: 'working',
    path,
    oldPath,
    status,
    kind: status === 'submodule' ? 'submodule' : 'text',
    displayPath: path,
    hunks: [],
  };
}

describe('WorkspaceActionService.discardWorkingFile', () => {
  let service: WorkspaceActionService;
  let gitMock: {
    cleanPath: ReturnType<typeof vi.fn>;
    restoreWorktree: ReturnType<typeof vi.fn>;
  };
  let providerMock: {
    getFiles: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = new WorkspaceActionService('/repo/root');
    gitMock = {
      cleanPath: vi.fn().mockResolvedValue(undefined),
      restoreWorktree: vi.fn().mockResolvedValue(undefined),
    };
    providerMock = {
      getFiles: vi.fn(),
    };
    (service as unknown as { git: typeof gitMock; provider: typeof providerMock }).git = gitMock;
    (service as unknown as { provider: typeof providerMock }).provider = providerMock;
  });

  it('cleans untracked files', async () => {
    // Given: target file is untracked in the working tree
    providerMock.getFiles.mockResolvedValue([createWorkingFile('new.ts', 'untracked')]);

    // When
    await service.discardWorkingFile('new.ts');

    // Then
    expect(gitMock.cleanPath).toHaveBeenCalledWith('new.ts');
    expect(gitMock.restoreWorktree).not.toHaveBeenCalled();
  });

  it('restores modified files from HEAD', async () => {
    // Given: target file is modified in the working tree
    providerMock.getFiles.mockResolvedValue([createWorkingFile('a.ts', 'modified')]);

    // When
    await service.discardWorkingFile('a.ts');

    // Then
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith(['a.ts']);
    expect(gitMock.cleanPath).not.toHaveBeenCalled();
  });

  it('restores deleted files from HEAD', async () => {
    // Given: target file is deleted in the working tree
    providerMock.getFiles.mockResolvedValue([createWorkingFile('deleted.ts', 'deleted')]);

    // When
    await service.discardWorkingFile('deleted.ts');

    // Then
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith(['deleted.ts']);
    expect(gitMock.cleanPath).not.toHaveBeenCalled();
  });

  it('restores binary files from HEAD', async () => {
    // Given: target file is a binary diff in the working tree
    providerMock.getFiles.mockResolvedValue([createWorkingFile('image.png', 'binary')]);

    // When
    await service.discardWorkingFile('image.png');

    // Then
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith(['image.png']);
    expect(gitMock.cleanPath).not.toHaveBeenCalled();
  });

  it('restores both old and new paths for renamed files', async () => {
    // Given: target file is renamed
    providerMock.getFiles.mockResolvedValue([
      createWorkingFile('new-name.ts', 'renamed', 'old-name.ts'),
    ]);

    // When
    await service.discardWorkingFile('new-name.ts');

    // Then
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith(['old-name.ts', 'new-name.ts']);
  });

  it('fails when file is not found in the working tree', async () => {
    // Given: working tree list does not contain the requested path
    providerMock.getFiles.mockResolvedValue([createWorkingFile('a.ts', 'modified')]);

    // When / Then
    await expect(service.discardWorkingFile('missing.ts')).rejects.toThrow(
      'File not found in working tree',
    );
  });

  it('fails for submodule changes', async () => {
    // Given: target file is a submodule change
    providerMock.getFiles.mockResolvedValue([createWorkingFile('submodule', 'submodule')]);

    // When / Then
    await expect(service.discardWorkingFile('submodule')).rejects.toThrow(
      'Discard is not supported for submodule changes',
    );
  });

  it('rejects unsafe traversal paths', async () => {
    // Given: target path escapes repository root
    providerMock.getFiles.mockResolvedValue([createWorkingFile('../outside.txt', 'untracked')]);

    // When / Then
    await expect(service.discardWorkingFile('../outside.txt')).rejects.toThrow(
      'Path traversal detected',
    );
  });
});
