import { describe, expect, it } from 'vitest';
import { abbreviateFilePath, resolveAbsoluteFilePath } from './file-path';

describe('resolveAbsoluteFilePath', () => {
  it('joins a POSIX repository root and relative path', () => {
    // Given: a POSIX repository root and Git-style relative path
    const repositoryRoot = '/Users/dev/projects/sift';
    const filePath = 'src/client/App.tsx';

    // When
    const result = resolveAbsoluteFilePath(repositoryRoot, filePath);

    // Then
    expect(result).toBe('/Users/dev/projects/sift/src/client/App.tsx');
  });

  it('avoids duplicate separators after the repository root', () => {
    // Given: a repository root with a trailing separator
    const repositoryRoot = '/Users/dev/projects/sift/';

    // When
    const result = resolveAbsoluteFilePath(repositoryRoot, '/src/client/App.tsx');

    // Then
    expect(result).toBe('/Users/dev/projects/sift/src/client/App.tsx');
  });

  it('uses Windows separators when the repository root is a Windows path', () => {
    // Given: a Windows repository root and Git-style relative path
    const repositoryRoot = String.raw`C:\Users\dev\projects\sift`;

    // When
    const result = resolveAbsoluteFilePath(repositoryRoot, 'src/client/App.tsx');

    // Then
    expect(result).toBe(String.raw`C:\Users\dev\projects\sift\src\client\App.tsx`);
  });
});

describe('abbreviateFilePath', () => {
  it('keeps a root-level file name unchanged', () => {
    // Given: a file at the repository root
    const filePath = 'VeryLongRootFileName.ts';

    // When
    const result = abbreviateFilePath(filePath);

    // Then
    expect(result).toBe(filePath);
  });

  it('keeps only the file name for a nested POSIX path', () => {
    // Given: a nested Git-style file path
    const filePath = 'src/client/components/file-list/FileList.tsx';

    // When
    const result = abbreviateFilePath(filePath);

    // Then
    expect(result).toBe('.../FileList.tsx');
  });

  it('keeps only the file name for a nested Windows path', () => {
    // Given: a nested Windows-style file path
    const filePath = String.raw`src\client\components\FileList.tsx`;

    // When
    const result = abbreviateFilePath(filePath);

    // Then
    expect(result).toBe('.../FileList.tsx');
  });
});
