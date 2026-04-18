import { useDiffData } from './hooks/useDiffData';
import { useNotes } from './hooks/useNotes';
import { FileList } from './components/file-list/FileList';
import { UnifiedDiffViewer } from './components/diff/UnifiedDiffViewer';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';
import { useWorkingPane } from './hooks/useWorkingPane';
import { useStagedPane } from './hooks/useStagedPane';
import { useFileSelection } from './hooks/useFileSelection';
import { NotesListModal } from './components/notes/NotesListModal';
import { usePaneResize } from './hooks/usePaneResize';
import { useNotesPanel } from './hooks/useNotesPanel';
import { useSession } from './hooks/useSession';
import { useRefreshController } from './hooks/useRefreshController';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import { usePaneFileActions } from './hooks/usePaneFileActions';
import { httpDiffReader } from './infrastructure/http/diffClient';
import { httpSessionReader } from './infrastructure/http/sessionClient';
import { httpWorkspaceActions } from './infrastructure/http/workspaceActionsClient';
import { sseRepositoryChangeSource } from './infrastructure/event/repositoryChangeSource';

function App() {
  const {
    workingFiles: serverWorkingFiles,
    stagedFiles: serverStagedFiles,
    loading,
    initialized,
    error: diffError,
    refresh,
  } = useDiffData(httpDiffReader);
  const { repository } = useSession(httpSessionReader);
  const { notes, addNote, updateNote, deleteNote, clearNotes } = useNotes();
  const { refreshAll } = useRefreshController({
    workingFiles: serverWorkingFiles,
    stagedFiles: serverStagedFiles,
    refresh,
    clearNotes,
  });

  const {
    stageFile,
    unstageFile,
    discardWorkingFile,
    stageHunk,
    unstageHunk,
    acting,
    error: actionError,
  } = useWorkspaceActions(httpWorkspaceActions, refreshAll);
  useAutoRefresh(sseRepositoryChangeSource, refreshAll, { enabled: initialized, paused: acting });

  const {
    files: workingFiles,
    stage,
    discard,
  } = useWorkingPane(serverWorkingFiles, stageFile, discardWorkingFile);
  const { files: stagedFiles, unstage } = useStagedPane(serverStagedFiles, unstageFile);
  const { selectedFile, paneMode, select, applyActionResult, handleBoundaryNavigate } =
    useFileSelection(workingFiles, stagedFiles);
  const paneFileActions = usePaneFileActions({
    selectedFile,
    paneMode,
    stage,
    unstage,
    discard,
    applyActionResult,
  });
  const notesPanel = useNotesPanel({
    notes,
    workingFiles,
    stagedFiles,
    selectedFileId: selectedFile?.id ?? null,
  });

  const {
    appMainRef,
    sidebarRef,
    sidebarStyle,
    workingPaneStyle,
    sidebarSplitterProps,
    paneSplitterProps,
  } = usePaneResize();

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-brand">
          <img src="/favicon.svg" alt="Sift Logo" style={{ width: '22px', height: '22px' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Sift</h1>
          {repository && (
            <span className="app-repository-name" title={repository.root}>
              {repository.name}
            </span>
          )}
        </div>
        <div className="app-header-actions">
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
          {notesPanel.canOpen && (
            <button
              onClick={notesPanel.toggle}
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
        {notesPanel.isOpen && (
          <NotesListModal
            notes={notes}
            onClose={notesPanel.close}
            onDeleteNote={deleteNote}
            resolveFilePath={notesPanel.resolveFilePath}
          />
        )}
      </div>
      <main className="app-main" ref={appMainRef}>
        <div className="pane sidebar-container" ref={sidebarRef} style={sidebarStyle}>
          <div className="sidebar-panel" style={workingPaneStyle}>
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
                  onSelect={(file) => select(file, 'working')}
                  onActivate={(file) => void paneFileActions.stageFile(file)}
                  onBoundaryNavigate={(direction) => handleBoundaryNavigate('working', direction)}
                />
              )}
            </div>
          </div>
          <div {...paneSplitterProps} />
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
                  onSelect={(file) => select(file, 'staged')}
                  onActivate={(file) => void paneFileActions.unstageFile(file)}
                  onBoundaryNavigate={(direction) => handleBoundaryNavigate('staged', direction)}
                />
              )}
            </div>
          </div>
        </div>
        <div {...sidebarSplitterProps} />
        <div className="pane main-diff">
          <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{selectedFile ? selectedFile.displayPath : 'Diff Viewer'}</span>
            {selectedFile && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={paneFileActions.toggleSelectedFileStage}
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
                {paneMode === 'working' && (
                  <button
                    onClick={() => void paneFileActions.discardFile(selectedFile)}
                    style={{
                      background: '#f85149',
                      color: '#fff',
                      border: '1px solid rgba(240,246,252,0.1)',
                      borderRadius: '4px',
                      padding: '0.1rem 0.6rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Discard
                  </button>
                )}
              </div>
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
                notes={notesPanel.selectedFileNotes}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                resolveFilePath={notesPanel.resolveFilePath}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
