import { useCallback, useState, useEffect } from 'react';
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
  const [workingFiles, setWorkingFiles] = useState<DiffFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<DiffFile[]>([]);

  useEffect(() => {
    setWorkingFiles(serverWorkingFiles);
  }, [serverWorkingFiles]);

  useEffect(() => {
    setStagedFiles(serverStagedFiles);
  }, [serverStagedFiles]);

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

  const handleSelect = useCallback((file: DiffFile, pane: 'working' | 'staged') => {
    setSelectedFile(file);
    setPaneMode(pane);
  }, []);

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
        </div>
      </header>
      <main className="app-main">
        <div className="pane sidebar-container">
          <div className="sidebar-panel">
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
          <div className="sidebar-panel" style={{ borderTop: '1px solid var(--border-color)' }}>
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
