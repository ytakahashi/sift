import { describe, expect, it } from 'vitest';
import { resolveNoteFilePath } from './resolve-note-file-path';

function createFile(id: string, displayPath = `${id}.ts`): { id: string; displayPath: string } {
  return {
    id,
    displayPath,
  };
}

describe('resolveNoteFilePath', () => {
  it('returns displayPath when file exists in working files', () => {
    // Given: the target fileId exists in workingFiles
    const workingFiles = [createFile('file-a', 'src/file-a.ts')];

    // When: the fileId is resolved
    const result = resolveNoteFilePath('file-a', workingFiles, []);

    // Then: it returns the working file displayPath
    expect(result).toBe('src/file-a.ts');
  });

  it('returns displayPath when file exists in staged files', () => {
    // Given: the target fileId exists in stagedFiles
    const stagedFiles = [createFile('file-b', 'src/file-b.ts')];

    // When: the fileId is resolved
    const result = resolveNoteFilePath('file-b', [], stagedFiles);

    // Then: it returns the staged file displayPath
    expect(result).toBe('src/file-b.ts');
  });

  it('returns fileId when file is not found', () => {
    // Given: the target fileId does not exist in working or staged lists
    const workingFiles = [createFile('known')];

    // When: a missing fileId is resolved
    const result = resolveNoteFilePath('missing', workingFiles, []);

    // Then: it returns the fileId itself as fallback
    expect(result).toBe('missing');
  });
});
