import { useMemo, useState, type ReactElement } from 'react';
import { ArrowLeftToLine, ArrowRightFromLine, ArrowRightToLine } from 'lucide-react';
import type { RepositoryId, RepositoryList } from '../../domain/repository/repository';
import { useDiffData } from '../hooks/diff/useDiffData';
import { useNotes } from '../hooks/notes/useNotes';
import { FileList } from '../components/file-list/FileList';
import { PaneBulkActions } from '../components/file-list/PaneBulkActions';
import { UnifiedDiffViewer } from '../components/diff/UnifiedDiffViewer';
import { RepositorySidebar } from '../components/repository-sidebar/RepositorySidebar';
import { useWorkspaceActions } from '../hooks/workspace-actions/useWorkspaceActions';
import { useWorkingPane } from '../hooks/panes/useWorkingPane';
import { useStagedPane } from '../hooks/panes/useStagedPane';
import { useFileSelection } from '../hooks/panes/useFileSelection';
import { NotesListModal } from '../components/notes/NotesListModal';
import { useRepository } from '../hooks/repositories/useRepository';
import { useRepositoryList } from '../hooks/repositories/useRepositoryList';
import { usePaneResize } from '../hooks/layout/usePaneResize';
import { useNotesPanel } from '../hooks/notes/useNotesPanel';
import { useFileNoteEditor } from '../hooks/notes/useFileNoteEditor';
import { useRefreshController } from '../hooks/sync/useRefreshController';
import { useAutoRefresh } from '../hooks/sync/useAutoRefresh';
import { usePaneFileActions } from '../hooks/panes/usePaneFileActions';
import { useDiscardConfirmModal } from '../hooks/discard-confirm/useDiscardConfirmModal';
import { DiscardConfirmModal } from '../components/discard-confirm/DiscardConfirmModal';
import type { AppDependencies } from '../composition/dependencies';

export interface RepositoryViewerPageProps {
  dependencies: AppDependencies;
  repoId: RepositoryId;
  onNavigateToRoot: () => void;
  onSelectRepository: (repoId: RepositoryId) => void;
}

export function RepositoryViewerPage({
  dependencies,
  repoId,
  onNavigateToRoot,
  onSelectRepository,
}: RepositoryViewerPageProps): ReactElement {
  const [isRepositorySidebarOpen, setIsRepositorySidebarOpen] = useState(false);
  const repositoryList = useRepositoryList(dependencies.repositoryReader, {
    enabled: isRepositorySidebarOpen,
  });

  const handleSelectRepository = (selectedRepoId: RepositoryId): void => {
    // Defensive guard: `RepositorySidebarRow` already prevents clicks on the
    // current repository, but we double-check here so future callers cannot
    // accidentally trigger a no-op navigation that would still close the sidebar.
    if (selectedRepoId === repoId) {
      return;
    }

    setIsRepositorySidebarOpen(false);
    onSelectRepository(selectedRepoId);
  };

  return (
    <RepositoryWorkspace
      key={repoId}
      dependencies={dependencies}
      isRepositorySidebarOpen={isRepositorySidebarOpen}
      onNavigateToRoot={onNavigateToRoot}
      onSelectRepository={handleSelectRepository}
      onToggleRepositorySidebar={() => setIsRepositorySidebarOpen((isOpen) => !isOpen)}
      repoId={repoId}
      repositoryList={repositoryList.repositories}
      repositoryListConfigMissingError={repositoryList.configMissingError}
      repositoryListError={repositoryList.error}
      repositoryListLoading={repositoryList.loading}
    />
  );
}

interface RepositoryWorkspaceProps {
  dependencies: AppDependencies;
  isRepositorySidebarOpen: boolean;
  onNavigateToRoot: () => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  onToggleRepositorySidebar: () => void;
  repoId: RepositoryId;
  repositoryList: RepositoryList | null;
  repositoryListConfigMissingError: string | null;
  repositoryListError: string | null;
  repositoryListLoading: boolean;
}

const DEFAULT_REPOSITORY_SIDEBAR_WIDTH_PX = 280;

function resolveRepositorySidebarWidthPx(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_REPOSITORY_SIDEBAR_WIDTH_PX;
  }

  const width = Number.parseFloat(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--repository-sidebar-width')
      .trim(),
  );

  return Number.isFinite(width) ? width : DEFAULT_REPOSITORY_SIDEBAR_WIDTH_PX;
}

function RepositoryWorkspace({
  dependencies,
  isRepositorySidebarOpen,
  onNavigateToRoot,
  onSelectRepository,
  onToggleRepositorySidebar,
  repoId,
  repositoryList,
  repositoryListConfigMissingError,
  repositoryListError,
  repositoryListLoading,
}: RepositoryWorkspaceProps): ReactElement {
  const [isFileListOpen, setIsFileListOpen] = useState(true);
  // Read `--repository-sidebar-width` once at mount. The CSS variable is a fixed
  // value today, so this skips re-reading `getComputedStyle` on every render.
  // Revisit if the variable becomes responsive (e.g., changes via media query).
  const repositorySidebarWidthPx = useMemo(() => resolveRepositorySidebarWidthPx(), []);
  const {
    workingFiles: serverWorkingFiles,
    stagedFiles: serverStagedFiles,
    loading,
    initialized,
    error: diffError,
    refresh,
  } = useDiffData(dependencies.diffReader, repoId);
  // Repository metadata is only used to label the header. While it loads, the
  // rest of the repository viewer can render without a placeholder.
  const { repository, error: repositoryError } = useRepository(
    dependencies.repositoryReader,
    repoId,
  );
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
    stageAllWorkingFiles,
    unstageAllStagedFiles,
    discardWorkingFile,
    discardAllWorkingFiles,
    stageHunk,
    unstageHunk,
    acting,
    error: actionError,
  } = useWorkspaceActions(dependencies.workspaceActions, repoId, refreshAll);
  useAutoRefresh(dependencies.repositoryChangeSource, repoId, refreshAll, {
    enabled: initialized,
    paused: acting,
  });

  const {
    files: workingFiles,
    stage,
    discard,
    stageAll,
    discardAll,
  } = useWorkingPane(
    serverWorkingFiles,
    stageFile,
    discardWorkingFile,
    stageAllWorkingFiles,
    discardAllWorkingFiles,
  );
  const {
    files: stagedFiles,
    unstage,
    unstageAll,
  } = useStagedPane(serverStagedFiles, unstageFile, unstageAllStagedFiles);
  const { selectedFile, paneMode, select, applyActionResult, handleBoundaryNavigate } =
    useFileSelection(workingFiles, stagedFiles);
  const { pendingRequest, requestConfirmation, handleConfirm, handleCancel } =
    useDiscardConfirmModal();

  const paneFileActions = usePaneFileActions({
    selectedFile,
    paneMode,
    stage,
    unstage,
    discard,
    stageAll,
    unstageAll,
    discardAll,
    applyActionResult,
    requestConfirmation,
  });
  const notesPanel = useNotesPanel({
    notes,
    workingFiles,
    stagedFiles,
    selectedFileId: selectedFile?.id ?? null,
  });
  const fileNoteEditor = useFileNoteEditor(selectedFile?.id ?? null);

  const {
    appMainRef,
    sidebarRef,
    sidebarStyle,
    workingPaneStyle,
    sidebarSplitterProps,
    paneSplitterProps,
  } = usePaneResize({
    reservedRightWidthPx: isRepositorySidebarOpen ? repositorySidebarWidthPx : 0,
  });
  const repositorySidebarToggleLabel = isRepositorySidebarOpen
    ? 'Close repository sidebar'
    : 'Open repository sidebar';
  const RepositorySidebarToggleIcon = isRepositorySidebarOpen ? ArrowRightToLine : ArrowLeftToLine;
  const fileListToggleLabel = isFileListOpen ? 'Hide file list' : 'Show file list';
  const FileListToggleIcon = isFileListOpen ? ArrowLeftToLine : ArrowRightFromLine;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-brand">
          <button className="app-brand-home" onClick={onNavigateToRoot} type="button">
            <img className="app-brand-logo" src="/favicon.svg" alt="" />
            <h1 className="app-brand-title">Sift</h1>
          </button>
          {repository && (
            <span className="app-repository-name" title={repository.path}>
              {repository.name}
            </span>
          )}
        </div>
        <div className="app-header-actions">
          {/* These errors come from different workflows. Splitting them into
          contextual surfaces later would make the UI easier to act on. */}
          {(repositoryError || diffError || actionError) && (
            <span style={{ color: '#f85149' }}>{repositoryError || diffError || actionError}</span>
          )}
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
          <button className="secondary-button" onClick={refreshAll} type="button">
            Refresh
          </button>
          <button
            aria-label={repositorySidebarToggleLabel}
            aria-pressed={isRepositorySidebarOpen}
            className="secondary-button repository-sidebar-toggle-button"
            onClick={onToggleRepositorySidebar}
            title={repositorySidebarToggleLabel}
            type="button"
          >
            <RepositorySidebarToggleIcon aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
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
        {isFileListOpen && (
          <>
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
                      onBoundaryNavigate={(direction) =>
                        handleBoundaryNavigate('working', direction)
                      }
                    />
                  )}
                </div>
                <PaneBulkActions
                  actions={[
                    {
                      label: 'Stage All',
                      tone: 'success',
                      onClick: () => void paneFileActions.stageAllWorkingFiles(),
                    },
                    {
                      label: 'Discard All',
                      tone: 'danger',
                      onClick: () => void paneFileActions.discardAllWorkingFiles(),
                    },
                  ]}
                  disabled={acting || workingFiles.length === 0}
                />
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
                      onBoundaryNavigate={(direction) =>
                        handleBoundaryNavigate('staged', direction)
                      }
                    />
                  )}
                </div>
                <PaneBulkActions
                  actions={[
                    {
                      label: 'Unstage All',
                      tone: 'danger',
                      onClick: () => void paneFileActions.unstageAllStagedFiles(),
                    },
                  ]}
                  disabled={acting || stagedFiles.length === 0}
                />
              </div>
            </div>
            <div {...sidebarSplitterProps} />
          </>
        )}
        <div className="pane main-diff">
          <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="diff-header-title-group">
              <button
                aria-expanded={isFileListOpen}
                aria-label={fileListToggleLabel}
                className="secondary-button file-list-toggle-button"
                onClick={() => setIsFileListOpen((isOpen) => !isOpen)}
                title={fileListToggleLabel}
                type="button"
              >
                <FileListToggleIcon aria-hidden="true" size={18} strokeWidth={1.8} />
              </button>
              <span>{selectedFile ? selectedFile.displayPath : 'Diff Viewer'}</span>
            </div>
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
                <button
                  onClick={fileNoteEditor.open}
                  style={{
                    background: 'transparent',
                    color: '#c9d1d9',
                    border: '1px solid #30363d',
                    borderRadius: '4px',
                    padding: '0.1rem 0.6rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  Add Note
                </button>
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
                isFileNoteEditorOpen={fileNoteEditor.isOpen}
                onCloseFileNoteEditor={fileNoteEditor.close}
              />
            )}
          </div>
        </div>
        {isRepositorySidebarOpen && (
          <RepositorySidebar
            configMissingError={repositoryListConfigMissingError}
            currentRepositoryId={repoId}
            error={repositoryListError}
            loading={repositoryListLoading}
            onSelectRepository={onSelectRepository}
            repositories={repositoryList}
          />
        )}
      </main>
      {pendingRequest && (
        <DiscardConfirmModal
          {...pendingRequest}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
