import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiffViewModelBuilder } from '../../../domain/diff/diff-view-model-builder';
import type { UnifiedRow } from '../../../domain/diff/diff-view-model-builder';
import { isFileLinesConsistentWithHunks } from '../../../domain/diff/file-content-consistency';
import type { DiffFile } from '../../../domain/diff/types';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { FileContentReader } from '../../application/ports';

type FullViewState =
  | { mode: 'compact'; file: DiffFile; error: string | null }
  | { mode: 'loading'; file: DiffFile }
  | { mode: 'full'; file: DiffFile; lines: string[] }
  | { mode: 'error'; file: DiffFile; error: string };

export interface UseFileFullViewResult {
  isFullView: boolean;
  loading: boolean;
  error: string | null;
  rows: UnifiedRow[];
  showFullView: () => void;
}

const CONTENT_CHANGED_ERROR =
  'The file changed before it could be displayed. Refresh the diff and try again.';

export function useFileFullView(
  file: DiffFile,
  repoId: RepositoryId,
  fileContentReader: FileContentReader,
): UseFileFullViewResult {
  const [state, setState] = useState<FullViewState>({
    mode: 'compact',
    file,
    error: null,
  });
  const latestRequestId = useRef(0);

  useEffect(() => {
    latestRequestId.current += 1;
  }, [file]);

  const showFullView = useCallback((): void => {
    const requestedFile = file;
    const requestId = ++latestRequestId.current;
    setState({ mode: 'loading', file: requestedFile });

    void (async (): Promise<void> => {
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const content = await fileContentReader.fetchFileContent(repoId, requestedFile.path);
          if (latestRequestId.current !== requestId) {
            return;
          }

          if (
            requestedFile.newBlobId === content.blobId &&
            isFileLinesConsistentWithHunks(requestedFile.hunks, content.lines)
          ) {
            setState({ mode: 'full', file: requestedFile, lines: content.lines });
            return;
          }
        }

        if (latestRequestId.current === requestId) {
          setState({ mode: 'error', file: requestedFile, error: CONTENT_CHANGED_ERROR });
        }
      } catch (error: unknown) {
        if (latestRequestId.current === requestId) {
          setState({
            mode: 'error',
            file: requestedFile,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
  }, [file, fileContentReader, repoId]);

  const isCurrentFileState = state.file === file;
  const isFullView = isCurrentFileState && state.mode === 'full';
  const loading = isCurrentFileState && state.mode === 'loading';
  const error =
    isCurrentFileState && (state.mode === 'compact' || state.mode === 'error') ? state.error : null;
  const rows = useMemo(
    () =>
      isFullView
        ? DiffViewModelBuilder.buildUnifiedFullFile(file.hunks, state.lines)
        : DiffViewModelBuilder.buildUnified(file.hunks),
    [file, isFullView, state],
  );

  return { isFullView, loading, error, rows, showFullView };
}
