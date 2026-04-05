import { useCallback, useState, useEffect } from 'react';
import { useDiffData } from './hooks/useDiffData';
import { useNotes } from './hooks/useNotes';
import { FileList } from './components/file-list/FileList';
import { UnifiedDiffViewer } from './components/diff/UnifiedDiffViewer';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';
import type { DiffFile } from '../domain/diff/types';

function App() {
  const { workingFiles, stagedFiles, loading, error: diffError, refresh } = useDiffData();
  const { notes, addNote, updateNote, deleteNote, clearNotes } = useNotes();
  const refreshAll = useCallback(async () => {
    await refresh();
    clearNotes();
  }, [refresh, clearNotes]);

  const { stageFile, unstageFile, stageHunk, unstageHunk, error: actionError } = useWorkspaceActions(refreshAll);
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null);
  const [paneMode, setPaneMode] = useState<'working' | 'staged'>('working');

  useEffect(() => {
    if (selectedFile) {
      const targetList = paneMode === 'working' ? workingFiles : stagedFiles;
      const updatedFile = targetList.find(f => f.path === selectedFile.path);
      if (updatedFile !== selectedFile) {
        setSelectedFile(updatedFile || null);
      }
    }
  }, [workingFiles, stagedFiles, paneMode, selectedFile]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Sift</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {(diffError || actionError) && <span style={{ color: '#f85149' }}>{diffError || actionError}</span>}
          <button 
            onClick={refreshAll}
            style={{ 
              background: 'transparent', border: '1px solid #30363d', 
              color: '#c9d1d9', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' 
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
                  selectedFileId={paneMode === 'working' ? selectedFile?.id ?? null : null}
                  onSelect={(file) => { setSelectedFile(file); setPaneMode('working'); }}
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
                  selectedFileId={paneMode === 'staged' ? selectedFile?.id ?? null : null}
                  onSelect={(file) => { setSelectedFile(file); setPaneMode('staged'); }}
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
                 onClick={() => paneMode === 'working' ? stageFile(selectedFile.path) : unstageFile(selectedFile.path)}
                 style={{
                  background: paneMode === 'working' ? '#238636' : '#da3633',
                  color: '#fff', border: '1px solid rgba(240,246,252,0.1)',
                  borderRadius: '4px', padding: '0.1rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem'
               }}>
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
                notes={notes.filter(n => n.target.fileId === selectedFile.id)}
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
