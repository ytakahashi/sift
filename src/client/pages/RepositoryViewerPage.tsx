import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ArrowLeftToLine, ArrowRightFromLine, ArrowRightToLine } from 'lucide-react';
import { isNoteEligibleFile } from '../../domain/notes/note-eligibility';
import type { RepositoryId, RepositoryList } from '../../domain/repository/repository';
import type { RepositoryTab } from '../presentation/repository-tabs/repository-tab';
import { RepositoryTabs } from '../components/repository-tabs/RepositoryTabs';
import { useDiffData } from '../hooks/diff/useDiffData';
import { useNotes } from '../hooks/notes/useNotes';
import { FileList } from '../components/file-list/FileList';
import { PaneBulkActions } from '../components/file-list/PaneBulkActions';
import { DiffFilesLineStats, DiffLineStats } from '../components/diff/DiffLineStats';
import { UnifiedDiffViewer } from '../components/diff/UnifiedDiffViewer';
import { RepositorySidebar } from '../components/repository-sidebar/RepositorySidebar';
import { useWorkspaceActions } from '../hooks/workspace-actions/useWorkspaceActions';
import { useWorkingPane } from '../hooks/panes/useWorkingPane';
import { useStagedPane } from '../hooks/panes/useStagedPane';
import { useFileSelection } from '../hooks/panes/useFileSelection';
import { NotesListModal } from '../components/notes/NotesListModal';
import { findDiffFileForNote } from '../../domain/notes/find-diff-file-for-note';
import type { Note } from '../../domain/notes/types';
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
import { AppHeader } from '../components/app-header/AppHeader';
import { toHeadLabel } from '../presentation/app-header/head-label';
import type { AppDependencies } from '../composition/dependencies';

export interface RepositoryViewerPageProps {
  dependencies: AppDependencies;
  repoId: RepositoryId;
  onNavigateToRoot: () => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  tabs: RepositoryTab[];
  onSelectTab: (repoId: RepositoryId) => void;
  onCloseTab: (repoId: RepositoryId) => void;
  onRepositoryResolved: (repoId: RepositoryId, name: string) => void;
}

export function RepositoryViewerPage({
  dependencies,
  repoId,
  onNavigateToRoot,
  onSelectRepository,
  tabs,
  onSelectTab,
  onCloseTab,
  onRepositoryResolved,
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
      tabs={tabs}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
      onRepositoryResolved={onRepositoryResolved}
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
  tabs: RepositoryTab[];
  onSelectTab: (repoId: RepositoryId) => void;
  onCloseTab: (repoId: RepositoryId) => void;
  onRepositoryResolved: (repoId: RepositoryId, name: string) => void;
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
  tabs,
  onSelectTab,
  onCloseTab,
  onRepositoryResolved,
}: RepositoryWorkspaceProps): ReactElement {
  const [isFileListOpen, setIsFileListOpen] = useState(true);
  const [fullViewToolbarTarget, setFullViewToolbarTarget] = useState<HTMLSpanElement | null>(null);
  // Read `--repository-sidebar-width` once at mount. The CSS variable is a fixed
  // value today, so this skips re-reading `getComputedStyle` on every render.
  // Revisit if the variable becomes responsive (e.g., changes via media query).
  const repositorySidebarWidthPx = useMemo(() => resolveRepositorySidebarWidthPx(), []);
  const {
    repoRoot,
    head,
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
  useEffect(() => {
    if (repository) {
      onRepositoryResolved(repoId, repository.name);
    }
  }, [onRepositoryResolved, repoId, repository]);
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    refetchNotes,
    mutating: notesMutating,
    error: notesError,
  } = useNotes(dependencies.notesGateway, repoId);
  const { refreshAll } = useRefreshController({
    workingFiles: serverWorkingFiles,
    stagedFiles: serverStagedFiles,
    refresh,
    refetchNotes,
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
    onNotesChange: () => {
      void refetchNotes();
    },
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
    selectedFilePath: selectedFile?.path ?? null,
  });
  const fileNoteEditor = useFileNoteEditor(selectedFile?.id ?? null);

  const handleSelectNoteLocation = (note: Note): void => {
    const match = findDiffFileForNote(workingFiles, stagedFiles, note);
    if (!match) {
      return;
    }
    select(match.file, match.pane);
    notesPanel.close();
  };

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
      {/* These errors come from different workflows. Splitting them into
      contextual surfaces later would make the UI easier to act on. */}
      <AppHeader
        onNavigateHome={onNavigateToRoot}
        repositoryLabel={repository ? { name: repository.name, path: repository.path } : undefined}
        branchLabel={toHeadLabel(head) ?? undefined}
        errorMessage={repositoryError || diffError || actionError || notesError}
        actions={
          <>
            {notesPanel.canOpen && (
              <button className="button" onClick={notesPanel.toggle} type="button">
                View Notes ({notes.length})
              </button>
            )}
            <button className="button" onClick={refreshAll} type="button">
              Refresh
            </button>
            <button
              aria-label={repositorySidebarToggleLabel}
              aria-pressed={isRepositorySidebarOpen}
              className="button repository-sidebar-toggle-button"
              onClick={onToggleRepositorySidebar}
              title={repositorySidebarToggleLabel}
              type="button"
            >
              <RepositorySidebarToggleIcon aria-hidden="true" size={18} strokeWidth={1.8} />
            </button>
          </>
        }
      />
      <RepositoryTabs tabs={tabs} activeId={repoId} onSelect={onSelectTab} onClose={onCloseTab} />
      <main className="app-main" ref={appMainRef}>
        {notesPanel.isOpen && (
          <NotesListModal
            notes={notes}
            onClose={notesPanel.close}
            onDeleteNote={deleteNote}
            onSelectLocation={handleSelectNoteLocation}
            deleteDisabled={notesMutating}
          />
        )}
        {isFileListOpen && (
          <>
            <div className="pane sidebar-container" ref={sidebarRef} style={sidebarStyle}>
              <div className="sidebar-panel" style={workingPaneStyle}>
                <div className="pane-header pane-header-with-stats">
                  <span>Working Directory ({workingFiles.length})</span>
                  <DiffFilesLineStats files={workingFiles} />
                </div>
                <div className="pane-content scroll-area" style={{ padding: 0 }}>
                  {loading && workingFiles.length === 0 ? (
                    <div style={{ padding: '1rem' }}>Loading...</div>
                  ) : (
                    <FileList
                      files={workingFiles}
                      repoRoot={repoRoot}
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
                      onClick: () => void paneFileActions.stageAllWorkingFiles(),
                    },
                    {
                      label: 'Discard All',
                      onClick: () => void paneFileActions.discardAllWorkingFiles(),
                    },
                  ]}
                  disabled={acting || workingFiles.length === 0}
                />
              </div>
              <div {...paneSplitterProps} />
              <div className="sidebar-panel">
                <div className="pane-header pane-header-with-stats">
                  <span>Staged Changes ({stagedFiles.length})</span>
                  <DiffFilesLineStats files={stagedFiles} />
                </div>
                <div className="pane-content scroll-area" style={{ padding: 0 }}>
                  {loading && stagedFiles.length === 0 ? (
                    <div style={{ padding: '1rem' }}>Loading...</div>
                  ) : (
                    <FileList
                      files={stagedFiles}
                      repoRoot={repoRoot}
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
                className="button file-list-toggle-button"
                onClick={() => setIsFileListOpen((isOpen) => !isOpen)}
                title={fileListToggleLabel}
                type="button"
              >
                <FileListToggleIcon aria-hidden="true" size={18} strokeWidth={1.8} />
              </button>
              <span
                data-full-view-toolbar-target="true"
                ref={setFullViewToolbarTarget}
                style={{ display: 'inline-flex', flex: '0 0 auto' }}
              />
              <span className="diff-header-file-name">
                {selectedFile ? selectedFile.displayPath : 'Diff Viewer'}
              </span>
              {selectedFile && <DiffLineStats file={selectedFile} />}
            </div>
            {selectedFile && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="button diff-file-action-button"
                  onClick={paneFileActions.toggleSelectedFileStage}
                  type="button"
                >
                  {paneMode === 'working' ? 'Stage file' : 'Unstage file'}
                </button>
                {paneMode === 'working' && (
                  <button
                    className="button diff-file-action-button"
                    onClick={() => void paneFileActions.discardFile(selectedFile)}
                    type="button"
                  >
                    Discard
                  </button>
                )}
                {isNoteEligibleFile(selectedFile) && (
                  <button
                    className="button diff-file-action-button"
                    onClick={fileNoteEditor.open}
                    type="button"
                  >
                    Add Note
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="pane-content scroll-area" style={{ padding: 0 }}>
            {!selectedFile ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>
                Select a file to view differences.
              </div>
            ) : (
              <UnifiedDiffViewer
                key={`${paneMode}:${selectedFile.id}`}
                file={selectedFile}
                repoId={repoId}
                fileContentReader={dependencies.fileContentReader}
                fullViewToolbarTarget={fullViewToolbarTarget}
                paneMode={paneMode}
                onStageHunk={(id) => stageHunk(selectedFile.path, id)}
                onUnstageHunk={(id) => unstageHunk(selectedFile.path, id)}
                notes={notesPanel.selectedFileNotes}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                notesDeleteDisabled={notesMutating}
                // The editor state is keyed by DiffFile.id, which does not
                // distinguish panes; a same-path entry in the other pane can be
                // a submodule (type transition), where notes are not allowed.
                isFileNoteEditorOpen={fileNoteEditor.isOpen && isNoteEligibleFile(selectedFile)}
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
