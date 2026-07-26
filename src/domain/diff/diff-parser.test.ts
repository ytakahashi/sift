import { describe, it, expect } from 'vitest';
import { parseDiff } from './diff-parser';

describe('parseDiff', () => {
  it('returns an empty array for an empty string', () => {
    // Given: an empty diff string
    const raw = '';

    // When: parsing the diff
    const files = parseDiff(raw, 'working');

    // Then: returns an empty array
    expect(files).toEqual([]);
  });

  it('parses a single file with add, delete, and context lines', () => {
    // Given: a raw diff string for a single file
    const raw = [
      'diff --git a/file.ts b/file.ts',
      'index abc1234..def5678 100644',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,3 +1,3 @@',
      ' line1',
      '-old line',
      '+new line',
      ' line3',
    ].join('\n');

    // When: parsing the diff in working bucket
    const files = parseDiff(raw, 'working');

    // Then: it correctly identifies the file, status, hunk details, and lines
    expect(files).toHaveLength(1);

    const file = files[0];
    expect(file.path).toBe('file.ts');
    expect(file.bucket).toBe('working');
    expect(file.status).toBe('modified');
    expect(file.kind).toBe('text');
    expect(file.newBlobId).toBe('def5678');
    expect(file.hunks).toHaveLength(1);

    const hunk = file.hunks[0];
    expect(hunk.oldStart).toBe(1);
    expect(hunk.oldLines).toBe(3);
    expect(hunk.newStart).toBe(1);
    expect(hunk.newLines).toBe(3);
    expect(hunk.lines).toHaveLength(4);

    // context line
    expect(hunk.lines[0]).toMatchObject({
      type: 'context',
      oldLineNumber: 1,
      newLineNumber: 1,
      content: 'line1',
    });
    // delete line
    expect(hunk.lines[1]).toMatchObject({
      type: 'delete',
      oldLineNumber: 2,
      newLineNumber: undefined,
      content: 'old line',
    });
    // add line
    expect(hunk.lines[2]).toMatchObject({
      type: 'add',
      oldLineNumber: undefined,
      newLineNumber: 2,
      content: 'new line',
    });
    // context line
    expect(hunk.lines[3]).toMatchObject({
      type: 'context',
      oldLineNumber: 3,
      newLineNumber: 3,
      content: 'line3',
    });
  });

  it('parses multiple files', () => {
    // Given: a raw diff string for multiple files
    const raw = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
      'diff --git a/b.ts b/b.ts',
      '--- a/b.ts',
      '+++ b/b.ts',
      '@@ -1,1 +1,1 @@',
      '-foo',
      '+bar',
    ].join('\n');

    // When: parsing the diff in staged bucket
    const files = parseDiff(raw, 'staged');

    // Then: it identifies both files correctly
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe('a.ts');
    expect(files[0].bucket).toBe('staged');
    expect(files[1].path).toBe('b.ts');
    expect(files[1].bucket).toBe('staged');
  });

  it('parses multiple hunks in a single file', () => {
    // Given: a raw diff string with two separate hunks
    const raw = [
      'diff --git a/file.ts b/file.ts',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,2 +1,2 @@',
      ' ctx',
      '-old1',
      '+new1',
      '@@ -10,2 +10,2 @@',
      ' ctx2',
      '-old2',
      '+new2',
    ].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'working');

    // Then: it identifies both hunks in the single file
    expect(files).toHaveLength(1);
    expect(files[0].hunks).toHaveLength(2);

    expect(files[0].hunks[0].oldStart).toBe(1);
    expect(files[0].hunks[1].oldStart).toBe(10);
  });

  it('detects new file mode', () => {
    // Given: a raw diff string for a new file addition
    const raw = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.ts',
      '@@ -0,0 +1,2 @@',
      '+line1',
      '+line2',
    ].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'staged');

    // Then: it identifies the file status as 'added'
    expect(files[0].status).toBe('added');
  });

  it('detects deleted file mode', () => {
    // Given: a raw diff string for a file deletion
    const raw = [
      'diff --git a/old.ts b/old.ts',
      'deleted file mode 100644',
      '--- a/old.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-line1',
      '-line2',
    ].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'working');

    // Then: it identifies the file status as 'deleted'
    expect(files[0].status).toBe('deleted');
  });

  it('detects rename', () => {
    // Given: a raw diff string for a file rename
    const raw = [
      'diff --git a/old-name.ts b/new-name.ts',
      'similarity index 95%',
      'rename from old-name.ts',
      'rename to new-name.ts',
      '--- a/old-name.ts',
      '+++ b/new-name.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'staged');

    // Then: it identifies the file status as 'renamed' and sets path/oldPath
    expect(files[0].status).toBe('renamed');
    expect(files[0].path).toBe('new-name.ts');
    expect(files[0].oldPath).toBe('old-name.ts');
  });

  it('detects binary files', () => {
    // Given: a raw diff string for binary file differences
    const raw = [
      'diff --git a/image.png b/image.png',
      'Binary files a/image.png and b/image.png differ',
    ].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'working');

    // Then: it identifies the file kind as 'binary'
    expect(files[0].kind).toBe('binary');
  });

  it('detects submodule changes', () => {
    // Given: a raw diff string for submodule changes
    const raw = ['diff --git a/sub b/sub', 'Submodule sub abc1234..def5678:'].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'working');

    // Then: it identifies the file kind and status as 'submodule'
    expect(files[0].kind).toBe('submodule');
    expect(files[0].status).toBe('submodule');
  });

  it('skips "No newline at end of file" marker', () => {
    // Given: a raw diff string with "No newline at end of file" markers
    const raw = [
      'diff --git a/file.ts b/file.ts',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '\\ No newline at end of file',
      '+new',
      '\\ No newline at end of file',
    ].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'working');

    // Then: it skips the marker lines and only contains delete/add lines
    const lines = files[0].hunks[0].lines;
    expect(lines).toHaveLength(2);
    expect(lines[0].type).toBe('delete');
    expect(lines[1].type).toBe('add');
  });

  it('handles hunk header without line count (defaults to 1)', () => {
    // Given: a hunk header that only specifies the start line (e.g., @@ -5 +5 @@)
    const raw = [
      'diff --git a/file.ts b/file.ts',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -5 +5 @@',
      '-old',
      '+new',
    ].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'working');

    // Then: it defaults the line counts to 1
    const hunk = files[0].hunks[0];
    expect(hunk.oldStart).toBe(5);
    expect(hunk.oldLines).toBe(1);
    expect(hunk.newStart).toBe(5);
    expect(hunk.newLines).toBe(1);
  });

  it('sets deterministic IDs for files, hunks, and lines', () => {
    // Given: a simple diff
    const raw = [
      'diff --git a/file.ts b/file.ts',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');

    // When: parsing the diff
    const files = parseDiff(raw, 'working');

    // Then: it sets deterministic IDs for all hierarchical objects
    expect(files[0].id).toBe('file-file.ts');
    expect(files[0].hunks[0].id).toBe('hunk-file.ts-1');
    expect(files[0].hunks[0].lines[0].id).toBe('line-hunk-file.ts-1-0');
    expect(files[0].hunks[0].lines[1].id).toBe('line-hunk-file.ts-1-1');
  });
});
