import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
import { WorkspaceActionServiceImpl } from './workspace-action-service-impl';

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

describe('WorkspaceActionServiceImpl.discardWorkingFile', () => {
  let service: WorkspaceActionServiceImpl;
  let gitMock: {
    runGitCommand: ReturnType<typeof vi.fn>;
    cleanPath: ReturnType<typeof vi.fn>;
    restoreWorktree: ReturnType<typeof vi.fn>;
  };
  let providerMock: {
    getFiles: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = new WorkspaceActionServiceImpl('/repo/root');
    gitMock = {
      runGitCommand: vi.fn().mockResolvedValue(''),
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

    // Then: resolveSafePath resolves the relative path to an absolute path under the repo root
    expect(gitMock.cleanPath).toHaveBeenCalledWith('/repo/root/new.ts');
    expect(gitMock.restoreWorktree).not.toHaveBeenCalled();
  });

  it('restores modified files from HEAD', async () => {
    // Given: target file is modified in the working tree
    providerMock.getFiles.mockResolvedValue([createWorkingFile('a.ts', 'modified')]);

    // When
    await service.discardWorkingFile('a.ts');

    // Then: resolveSafePath resolves the relative path to an absolute path under the repo root
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith(['/repo/root/a.ts']);
    expect(gitMock.cleanPath).not.toHaveBeenCalled();
  });

  it('restores deleted files from HEAD', async () => {
    // Given: target file is deleted in the working tree
    providerMock.getFiles.mockResolvedValue([createWorkingFile('deleted.ts', 'deleted')]);

    // When
    await service.discardWorkingFile('deleted.ts');

    // Then: resolveSafePath resolves the relative path to an absolute path under the repo root
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith(['/repo/root/deleted.ts']);
    expect(gitMock.cleanPath).not.toHaveBeenCalled();
  });

  it('restores binary files from HEAD', async () => {
    // Given: target file is a binary diff in the working tree
    providerMock.getFiles.mockResolvedValue([createWorkingFile('image.png', 'binary')]);

    // When
    await service.discardWorkingFile('image.png');

    // Then: resolveSafePath resolves the relative path to an absolute path under the repo root
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith(['/repo/root/image.png']);
    expect(gitMock.cleanPath).not.toHaveBeenCalled();
  });

  it('restores both old and new paths for renamed files', async () => {
    // Given: target file is renamed
    providerMock.getFiles.mockResolvedValue([
      createWorkingFile('new-name.ts', 'renamed', 'old-name.ts'),
    ]);

    // When
    await service.discardWorkingFile('new-name.ts');

    // Then: resolveSafePath resolves both paths to absolute paths under the repo root
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith([
      '/repo/root/old-name.ts',
      '/repo/root/new-name.ts',
    ]);
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

describe('WorkspaceActionServiceImpl bulk actions', () => {
  let service: WorkspaceActionServiceImpl;
  let gitMock: {
    runGitCommand: ReturnType<typeof vi.fn>;
    restoreWorktree: ReturnType<typeof vi.fn>;
  };
  let providerMock: {
    getFiles: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = new WorkspaceActionServiceImpl('/repo/root');
    gitMock = {
      runGitCommand: vi.fn().mockResolvedValue(''),
      restoreWorktree: vi.fn().mockResolvedValue(undefined),
    };
    providerMock = {
      getFiles: vi.fn(),
    };
    (service as unknown as { git: typeof gitMock; provider: typeof providerMock }).git = gitMock;
    (service as unknown as { provider: typeof providerMock }).provider = providerMock;
  });

  it('stages all working files including both paths for renamed files', async () => {
    // Given: working files include regular, untracked, and renamed changes
    providerMock.getFiles.mockResolvedValue([
      createWorkingFile('a.ts', 'modified'),
      createWorkingFile('new.ts', 'untracked'),
      createWorkingFile('renamed.ts', 'renamed', 'old.ts'),
    ]);

    // When
    await service.stageAllWorkingFiles();

    // Then
    expect(providerMock.getFiles).toHaveBeenCalledWith('working');
    expect(gitMock.runGitCommand).toHaveBeenCalledWith([
      'add',
      '-A',
      '--',
      '/repo/root/a.ts',
      '/repo/root/new.ts',
      '/repo/root/old.ts',
      '/repo/root/renamed.ts',
    ]);
  });

  it('does not run git when staging all working files with an empty pane', async () => {
    // Given: no working files are present
    providerMock.getFiles.mockResolvedValue([]);

    // When
    await service.stageAllWorkingFiles();

    // Then
    expect(gitMock.runGitCommand).not.toHaveBeenCalled();
  });

  it('unstages all staged files through HEAD when it exists', async () => {
    // Given: staged files exist and HEAD can be resolved
    providerMock.getFiles.mockResolvedValue([createWorkingFile('a.ts', 'modified')]);

    // When
    await service.unstageAllStagedFiles();

    // Then
    expect(providerMock.getFiles).toHaveBeenCalledWith('staged');
    expect(gitMock.runGitCommand).toHaveBeenNthCalledWith(1, ['rev-parse', 'HEAD']);
    expect(gitMock.runGitCommand).toHaveBeenNthCalledWith(2, [
      'reset',
      'HEAD',
      '--',
      '/repo/root/a.ts',
    ]);
  });

  it('does not run git when unstaging all staged files with an empty pane', async () => {
    // Given: no staged files are present
    providerMock.getFiles.mockResolvedValue([]);

    // When
    await service.unstageAllStagedFiles();

    // Then
    expect(providerMock.getFiles).toHaveBeenCalledWith('staged');
    expect(gitMock.runGitCommand).not.toHaveBeenCalled();
  });

  it('falls back to removing cached files when unstaging all without HEAD', async () => {
    // Given: the repository is on an initial commit with no HEAD
    providerMock.getFiles.mockResolvedValue([createWorkingFile('new.ts', 'added')]);
    gitMock.runGitCommand.mockRejectedValueOnce(new Error('no HEAD')).mockResolvedValueOnce('');

    // When
    await service.unstageAllStagedFiles();

    // Then
    expect(gitMock.runGitCommand).toHaveBeenNthCalledWith(2, [
      'rm',
      '--cached',
      '-f',
      '--',
      '/repo/root/new.ts',
    ]);
  });

  it('cleans untracked files and restores tracked files when discarding all', async () => {
    // Given: working files include untracked, modified, deleted, binary, and renamed changes
    providerMock.getFiles.mockResolvedValue([
      createWorkingFile('new.ts', 'untracked'),
      createWorkingFile('a.ts', 'modified'),
      createWorkingFile('deleted.ts', 'deleted'),
      createWorkingFile('image.png', 'binary'),
      createWorkingFile('renamed.ts', 'renamed', 'old.ts'),
    ]);

    // When
    await service.discardAllWorkingFiles();

    // Then
    expect(gitMock.runGitCommand).toHaveBeenCalledWith(['clean', '-f', '--', '/repo/root/new.ts']);
    expect(gitMock.restoreWorktree).toHaveBeenCalledWith([
      '/repo/root/a.ts',
      '/repo/root/deleted.ts',
      '/repo/root/image.png',
      '/repo/root/old.ts',
      '/repo/root/renamed.ts',
    ]);
  });

  it('rejects submodule changes before discarding all', async () => {
    // Given: the working pane includes a submodule change
    providerMock.getFiles.mockResolvedValue([
      createWorkingFile('new.ts', 'untracked'),
      createWorkingFile('submodule', 'submodule'),
    ]);

    // When / Then
    await expect(service.discardAllWorkingFiles()).rejects.toThrow(
      'Discard is not supported for submodule changes',
    );
    expect(gitMock.runGitCommand).not.toHaveBeenCalled();
    expect(gitMock.restoreWorktree).not.toHaveBeenCalled();
  });

  it('rejects unsafe traversal paths before discarding all', async () => {
    // Given: one working file path escapes the repository root
    providerMock.getFiles.mockResolvedValue([
      createWorkingFile('new.ts', 'untracked'),
      createWorkingFile('../outside.txt', 'modified'),
    ]);

    // When / Then
    await expect(service.discardAllWorkingFiles()).rejects.toThrow('Path traversal detected');
    expect(gitMock.runGitCommand).not.toHaveBeenCalled();
    expect(gitMock.restoreWorktree).not.toHaveBeenCalled();
  });
});
