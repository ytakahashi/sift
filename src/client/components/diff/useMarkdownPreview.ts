import { useCallback, useEffect, useRef, useState } from 'react';
import { isFileLinesConsistentWithHunks } from '../../../domain/diff/file-content-consistency';
import type { DiffFile } from '../../../domain/diff/types';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { BlobContentReader, FileContent, FileContentReader } from '../../application/ports';

export type MarkdownPreviewState =
  | { mode: 'source' }
  | { mode: 'loading' }
  | { mode: 'ready'; oldLines: string[]; newLines: string[] }
  | { mode: 'error'; error: string };

export type UseMarkdownPreviewResult = MarkdownPreviewState & {
  showPreview: () => void;
  showSource: () => void;
};

type StoredMarkdownPreviewState = MarkdownPreviewState & {
  file: DiffFile;
  repoId: RepositoryId;
};

const CONTENT_CHANGED_ERROR =
  'The file changed before it could be previewed. Refresh the diff and try again.';
const MISSING_BLOB_ID_ERROR =
  'Markdown preview requires a new blob ID and an old blob ID for modified files.';

export function useMarkdownPreview(
  file: DiffFile,
  repoId: RepositoryId,
  fileContentReader: FileContentReader,
  blobContentReader: BlobContentReader,
): UseMarkdownPreviewResult {
  const [state, setState] = useState<StoredMarkdownPreviewState>({
    mode: 'source',
    file,
    repoId,
  });
  const latestRequestId = useRef(0);

  useEffect(() => {
    latestRequestId.current += 1;
  }, [file, repoId]);

  const showSource = useCallback((): void => {
    latestRequestId.current += 1;
    setState({ mode: 'source', file, repoId });
  }, [file, repoId]);

  const showPreview = useCallback((): void => {
    const requestedFile = file;
    const requestedRepoId = repoId;
    const oldBlobId = requestedFile.oldBlobId;
    const newBlobId = requestedFile.newBlobId;
    // Git represents the absent old side of an added file with a zero object ID.
    // File status, rather than that transport sentinel, defines the empty document.
    const oldSideBlobId = requestedFile.status === 'added' ? null : oldBlobId;
    const requestId = ++latestRequestId.current;

    if (newBlobId === undefined || oldSideBlobId === undefined) {
      setState({
        mode: 'error',
        file: requestedFile,
        repoId: requestedRepoId,
        error: MISSING_BLOB_ID_ERROR,
      });
      return;
    }

    setState({ mode: 'loading', file: requestedFile, repoId: requestedRepoId });

    void (async (): Promise<void> => {
      try {
        const [oldLines, initialNewContent] = await Promise.all([
          fetchOldLines(requestedRepoId, oldSideBlobId, blobContentReader),
          fileContentReader.fetchFileContent(requestedRepoId, requestedFile.path),
        ]);
        if (latestRequestId.current !== requestId) {
          return;
        }

        let newContent: FileContent = initialNewContent;
        // The old side is an immutable blob or an empty document. Only the
        // index-backed new side can race, so retry that request alone.
        if (!isCurrentNewContent(requestedFile, newBlobId, newContent)) {
          newContent = await fileContentReader.fetchFileContent(
            requestedRepoId,
            requestedFile.path,
          );
          if (latestRequestId.current !== requestId) {
            return;
          }
        }

        if (!isCurrentNewContent(requestedFile, newBlobId, newContent)) {
          setState({
            mode: 'error',
            file: requestedFile,
            repoId: requestedRepoId,
            error: CONTENT_CHANGED_ERROR,
          });
          return;
        }

        setState({
          mode: 'ready',
          file: requestedFile,
          repoId: requestedRepoId,
          oldLines,
          newLines: newContent.lines,
        });
      } catch (error: unknown) {
        if (latestRequestId.current === requestId) {
          setState({
            mode: 'error',
            file: requestedFile,
            repoId: requestedRepoId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
  }, [blobContentReader, file, fileContentReader, repoId]);

  const actions = { showPreview, showSource };
  if (state.file !== file || state.repoId !== repoId) {
    return { mode: 'source', ...actions };
  }

  switch (state.mode) {
    case 'source':
      return { mode: 'source', ...actions };
    case 'loading':
      return { mode: 'loading', ...actions };
    case 'ready':
      return {
        mode: 'ready',
        oldLines: state.oldLines,
        newLines: state.newLines,
        ...actions,
      };
    case 'error':
      return { mode: 'error', error: state.error, ...actions };
    default: {
      const unhandledState: never = state;
      throw new Error(`Unhandled Markdown preview state: ${String(unhandledState)}`);
    }
  }
}

async function fetchOldLines(
  repoId: RepositoryId,
  blobId: string | null,
  blobContentReader: BlobContentReader,
): Promise<string[]> {
  if (blobId === null) {
    return [];
  }
  const content = await blobContentReader.fetchBlobContent(repoId, blobId);
  return content.lines;
}

function isCurrentNewContent(
  file: DiffFile,
  expectedBlobId: string,
  content: FileContent,
): boolean {
  return (
    content.blobId === expectedBlobId && isFileLinesConsistentWithHunks(file.hunks, content.lines)
  );
}
