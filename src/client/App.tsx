import {
  useCallback,
  useState,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useDiffData } from './hooks/useDiffData';
import { useNotes } from './hooks/useNotes';
import { FileList } from './components/file-list/FileList';
import { UnifiedDiffViewer } from './components/diff/UnifiedDiffViewer';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';
import type { DiffFile } from '../domain/diff/types';
import {
  getFallbackSelectionIndex,
  getSelectionByIndex,
} from './components/file-list/file-list-selection';
import { removeFileFromPane } from './components/file-list/file-list-optimistic';
import { NotesListModal } from './components/notes/NotesListModal';
import { clampSidebarWidth, clampWorkingPanelHeight } from './layout/pane-size';

type DragTarget = 'sidebar-width' | 'working-height';

function App() {
  const {
    workingFiles: serverWorkingFiles,
    stagedFiles: serverStagedFiles,
    loading,
    error: diffError,
    refresh,
  } = useDiffData();
  const { notes, addNote, updateNote, deleteNote, clearNotes } = useNotes();
  const refreshAll = useCallback(async () => {
    await refresh();
    clearNotes();
  }, [refresh, clearNotes]);

  const {
    stageFile,
    unstageFile,
    stageHunk,
    unstageHunk,
    acting,
    error: actionError,
  } = useWorkspaceActions(refreshAll);
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null);
  const [paneMode, setPaneMode] = useState<'working' | 'staged'>('working');
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  // Local mirrors of the server file lists. These exist to support optimistic UI:
  // when the user stages/unstages a file we remove it from the mirror immediately,
  // before the server confirms the action. On success the server refresh overwrites
  // the mirrors; on failure the mirrors are rolled back to the previous snapshot.
  const [workingFiles, setWorkingFiles] = useState<DiffFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<DiffFile[]>([]);
  const [sidebarWidthPx, setSidebarWidthPx] = useState<number>(300);
  const [workingPaneHeightPx, setWorkingPaneHeightPx] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const appMainRef = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);

  // One-way sync: propagate server data into the local mirrors.
  // Optimistic removals are overwritten when the next server refresh arrives.
  useEffect(() => {
    setWorkingFiles(serverWorkingFiles);
  }, [serverWorkingFiles]);

  useEffect(() => {
    setStagedFiles(serverStagedFiles);
  }, [serverStagedFiles]);

  // Keep the selected-file reference in sync with the current file lists.
  // After a server refresh the same logical file may be a new object, so we
  // replace the stale reference with the updated one. If the file no longer
  // exists in the list (e.g. it was moved to another pane by another process),
  // we clear the selection so the diff viewer does not show stale content.
  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    const targetList = paneMode === 'working' ? workingFiles : stagedFiles;
    const updatedFile = targetList.find((file) => file.id === selectedFile.id);
    if (updatedFile) {
      if (updatedFile !== selectedFile) {
        setSelectedFile(updatedFile);
      }
      return;
    }

    setSelectedFile(null);
  }, [paneMode, selectedFile, stagedFiles, workingFiles]);

  // Close notes modal if all notes are deleted
  useEffect(() => {
    if (isNotesModalOpen && notes.length === 0) {
      setIsNotesModalOpen(false);
    }
  }, [isNotesModalOpen, notes.length]);

  const stopDrag = useCallback(() => {
    dragTargetRef.current = null;
    setDragTarget(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const currentDragTarget = dragTargetRef.current;
      if (!currentDragTarget) {
        return;
      }

      if (currentDragTarget === 'sidebar-width') {
        const appMain = appMainRef.current;
        if (!appMain) {
          return;
        }
        const appRect = appMain.getBoundingClientRect();
        const widthPx = event.clientX - appRect.left;
        setSidebarWidthPx(clampSidebarWidth(widthPx, appRect.width));
        return;
      }

      const sidebar = sidebarRef.current;
      if (!sidebar) {
        return;
      }
      const sidebarRect = sidebar.getBoundingClientRect();
      const heightPx = event.clientY - sidebarRect.top;
      setWorkingPaneHeightPx(clampWorkingPanelHeight(heightPx, sidebarRect.height));
    };

    const handlePointerUp = () => {
      if (!dragTargetRef.current) {
        return;
      }
      stopDrag();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [stopDrag]);

  // Keep pane sizes valid if the app is resized after the user has dragged splitters.
  useEffect(() => {
    const clampCurrentLayout = () => {
      const appMain = appMainRef.current;
      if (appMain) {
        const appRect = appMain.getBoundingClientRect();
        setSidebarWidthPx((currentWidthPx) => clampSidebarWidth(currentWidthPx, appRect.width));
      }

      const sidebar = sidebarRef.current;
      if (sidebar) {
        const sidebarRect = sidebar.getBoundingClientRect();
        setWorkingPaneHeightPx((currentHeightPx) =>
          currentHeightPx === null
            ? currentHeightPx
            : clampWorkingPanelHeight(currentHeightPx, sidebarRect.height),
        );
      }
    };

    clampCurrentLayout();
    window.addEventListener('resize', clampCurrentLayout);
    return () => {
      window.removeEventListener('resize', clampCurrentLayout);
    };
  }, []);

  useEffect(() => {
    return () => {
      dragTargetRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  const handleSidebarSplitterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragTargetRef.current = 'sidebar-width';
      setDragTarget('sidebar-width');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [],
  );

  const handlePaneSplitterPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragTargetRef.current = 'working-height';
    setDragTarget('working-height');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  }, []);

  const handleSelect = useCallback((file: DiffFile, pane: 'working' | 'staged') => {
    setSelectedFile(file);
    setPaneMode(pane);
  }, []);

  // Cross-pane keyboard navigation. The sidebar layout places Working Directory
  // above Staged Changes, so ArrowDown past the last working file jumps to the
  // first staged file, and ArrowUp past the first staged file jumps to the last
  // working file. The opposite directions (ArrowUp in working, ArrowDown in staged)
  // have no adjacent pane to jump to, so they are intentionally ignored.
  const handleBoundaryNavigate = useCallback(
    (pane: 'working' | 'staged', direction: 'previous' | 'next') => {
      if (pane === 'staged' && direction === 'previous' && workingFiles.length > 0) {
        setPaneMode('working');
        setSelectedFile(workingFiles[workingFiles.length - 1]);
        return;
      }

      if (pane === 'working' && direction === 'next' && stagedFiles.length > 0) {
        setPaneMode('staged');
        setSelectedFile(stagedFiles[0]);
      }
    },
    [stagedFiles, workingFiles],
  );

  // Optimistic stage/unstage flow:
  //   1. Snapshot current state for rollback.
  //   2. Compute which file to select after removal (fallback selection).
  //   3. Remove the file from the local mirror immediately (optimistic update).
  //   4. Await the server action.
  //   5. On failure, restore all snapshots to roll back the optimistic change.
  //      The server refresh triggered on success will reconcile the mirrors.
  const handleActivate = useCallback(
    async (file: DiffFile, pane: 'working' | 'staged') => {
      const previousWorkingFiles = workingFiles;
      const previousStagedFiles = stagedFiles;
      const previousSelectedFile = selectedFile;
      const previousPaneMode = paneMode;
      const isWorkingPane = pane === 'working';
      const files = isWorkingPane ? workingFiles : stagedFiles;
      const action = isWorkingPane ? stageFile : unstageFile;
      const currentIndex = files.findIndex((candidate) => candidate.id === file.id);
      const fallbackIndex = getFallbackSelectionIndex(currentIndex, files.length);
      const { nextSourceFiles, removedFile } = removeFileFromPane({
        sourceFiles: files,
        fileId: file.id,
      });

      // Guard against race conditions (e.g. double-click before the first action
      // completes and the file has already been removed from the mirror).
      if (!removedFile) {
        return;
      }

      const fallbackFile = getSelectionByIndex(nextSourceFiles, fallbackIndex);
      if (isWorkingPane) {
        setWorkingFiles(nextSourceFiles);
      } else {
        setStagedFiles(nextSourceFiles);
      }
      setPaneMode(pane);
      setSelectedFile(fallbackFile);

      // On failure, useWorkspaceActions sets acting=false (via finally) before
      // this catch block runs. React 18+ automatic batching ensures all state
      // updates within the same microtask are committed in a single render, so
      // the intermediate state (acting=false, files not yet rolled back) is
      // never visible to the user.
      try {
        await action(file.path);
      } catch {
        setWorkingFiles(previousWorkingFiles);
        setStagedFiles(previousStagedFiles);
        setSelectedFile(previousSelectedFile);
        setPaneMode(previousPaneMode);
      }
    },
    [paneMode, selectedFile, stageFile, stagedFiles, unstageFile, workingFiles],
  );

  const handleWorkingActivate = useCallback(
    (file: DiffFile) => void handleActivate(file, 'working'),
    [handleActivate],
  );

  const handleStagedActivate = useCallback(
    (file: DiffFile) => void handleActivate(file, 'staged'),
    [handleActivate],
  );

  const handleSelectedFileActivate = useCallback(() => {
    if (!selectedFile) return;
    void handleActivate(selectedFile, paneMode);
  }, [handleActivate, paneMode, selectedFile]);

  const resolveFilePath = useCallback(
    (fileId: string) => {
      const found =
        workingFiles.find((f) => f.id === fileId) || stagedFiles.find((f) => f.id === fileId);
      if (found) {
        return found.displayPath;
      }
      // Once we decide to use a dedicated FileId type, consider changing this to other value.
      return fileId;
    },
    [workingFiles, stagedFiles],
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/favicon.svg" alt="Sift Logo" style={{ width: '22px', height: '22px' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Sift</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {(diffError || actionError) && (
            <span style={{ color: '#f85149' }}>{diffError || actionError}</span>
          )}
          <button
            onClick={refreshAll}
            style={{
              background: 'transparent',
              border: '1px solid #30363d',
              color: '#c9d1d9',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
          {notes.length > 0 && (
            <button
              onClick={() => setIsNotesModalOpen((prev) => !prev)}
              style={{
                background: '#238636',
                color: '#fff',
                border: 'none',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              View Notes ({notes.length})
            </button>
          )}
        </div>
      </header>
      <div style={{ position: 'relative' }}>
        {isNotesModalOpen && (
          <NotesListModal
            notes={notes}
            onClose={() => setIsNotesModalOpen(false)}
            onDeleteNote={deleteNote}
            resolveFilePath={resolveFilePath}
          />
        )}
      </div>
      <main className="app-main" ref={appMainRef}>
        <div
          className="pane sidebar-container"
          ref={sidebarRef}
          style={{ width: `${sidebarWidthPx}px` }}
        >
          <div
            className="sidebar-panel"
            style={
              workingPaneHeightPx === null
                ? undefined
                : { flex: '0 0 auto', height: `${workingPaneHeightPx}px` }
            }
          >
            <div className="pane-header">Working Directory ({workingFiles.length})</div>
            <div className="pane-content" style={{ padding: 0 }}>
              {loading && workingFiles.length === 0 ? (
                <div style={{ padding: '1rem' }}>Loading...</div>
              ) : (
                <FileList
                  files={workingFiles}
                  selectedFileId={paneMode === 'working' ? (selectedFile?.id ?? null) : null}
                  disabled={acting}
                  isActive={paneMode === 'working'}
                  onSelect={(file) => handleSelect(file, 'working')}
                  onActivate={handleWorkingActivate}
                  onBoundaryNavigate={(direction) => handleBoundaryNavigate('working', direction)}
                />
              )}
            </div>
          </div>
          <div
            className={`pane-splitter pane-splitter-horizontal ${
              dragTarget === 'working-height' ? 'is-dragging' : ''
            }`}
            role="separator"
            aria-label="Resize Working and Staged panes"
            aria-orientation="horizontal"
            onPointerDown={handlePaneSplitterPointerDown}
          />
          <div className="sidebar-panel">
            <div className="pane-header">Staged Changes ({stagedFiles.length})</div>
            <div className="pane-content" style={{ padding: 0 }}>
              {loading && stagedFiles.length === 0 ? (
                <div style={{ padding: '1rem' }}>Loading...</div>
              ) : (
                <FileList
                  files={stagedFiles}
                  selectedFileId={paneMode === 'staged' ? (selectedFile?.id ?? null) : null}
                  disabled={acting}
                  isActive={paneMode === 'staged'}
                  onSelect={(file) => handleSelect(file, 'staged')}
                  onActivate={handleStagedActivate}
                  onBoundaryNavigate={(direction) => handleBoundaryNavigate('staged', direction)}
                />
              )}
            </div>
          </div>
        </div>
        <div
          className={`pane-splitter pane-splitter-vertical ${
            dragTarget === 'sidebar-width' ? 'is-dragging' : ''
          }`}
          role="separator"
          aria-label="Resize sidebar and diff panes"
          aria-orientation="vertical"
          onPointerDown={handleSidebarSplitterPointerDown}
        />
        <div className="pane main-diff">
          <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{selectedFile ? selectedFile.displayPath : 'Diff Viewer'}</span>
            {selectedFile && (
              <button
                onClick={handleSelectedFileActivate}
                style={{
                  background: paneMode === 'working' ? '#238636' : '#da3633',
                  color: '#fff',
                  border: '1px solid rgba(240,246,252,0.1)',
                  borderRadius: '4px',
                  padding: '0.1rem 0.6rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {paneMode === 'working' ? 'Stage file' : 'Unstage file'}
              </button>
            )}
          </div>
          <div className="pane-content" style={{ padding: 0 }}>
            {!selectedFile ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>
                Select a file to view differences.
              </div>
            ) : (
              <UnifiedDiffViewer
                file={selectedFile}
                paneMode={paneMode}
                onStageHunk={(id) => stageHunk(selectedFile.path, id)}
                onUnstageHunk={(id) => unstageHunk(selectedFile.path, id)}
                notes={notes.filter((n) => n.target.fileId === selectedFile.id)}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
