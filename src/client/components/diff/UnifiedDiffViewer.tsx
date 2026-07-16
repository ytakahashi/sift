import React, { useMemo, useState, type ReactElement } from 'react';
import type { BaseDiffViewerProps } from './BaseDiffViewer';
import { DiffViewModelBuilder } from '../../../domain/diff/diff-view-model-builder';
import { NoteEditor } from '../notes/NoteEditor';
import { NoteCard } from '../notes/NoteCard';
import { SyntaxHighlightedLine } from './SyntaxHighlightedLine';

export function UnifiedDiffViewer({
  file,
  paneMode,
  onStageHunk,
  onUnstageHunk,
  notes = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  notesDeleteDisabled,
  resolveFilePath,
  isFileNoteEditorOpen = false,
  onCloseFileNoteEditor,
}: BaseDiffViewerProps): ReactElement {
  const rows = useMemo(() => DiffViewModelBuilder.buildUnified(file.hunks), [file.hunks]);
  const [activeEditorLine, setActiveEditorLine] = useState<number | null>(null);
  const fileNotes = notes.filter((note) => note.target.kind === 'file');

  const renderFileNotes = (): ReactElement | null => {
    if (!isFileNoteEditorOpen && fileNotes.length === 0) {
      return null;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {isFileNoteEditorOpen && (
          <NoteEditor
            onSave={async (val) => {
              if (val.trim()) {
                // Close only after the server accepted the note; a rejection
                // stays in the editor (draft + inline error).
                await onAddNote?.({ kind: 'file', path: file.path }, val);
              }
              onCloseFileNoteEditor?.();
            }}
            onCancel={() => onCloseFileNoteEditor?.()}
          />
        )}
        {/* Multiple notes may intentionally share the same file target. */}
        {fileNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            resolveFilePath={resolveFilePath}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
            deleteDisabled={notesDeleteDisabled}
          />
        ))}
      </div>
    );
  };

  const fileNoteContent = renderFileNotes();

  if (file.kind !== 'text') {
    return (
      <div>
        {fileNoteContent && <div style={{ padding: '0.5rem 1rem 0' }}>{fileNoteContent}</div>}
        <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>
          {file.kind === 'binary' || file.kind === 'image'
            ? 'Binary file changed'
            : 'Submodule changed'}
        </div>
      </div>
    );
  }

  return (
    <div
      className="unified-diff-viewer"
      style={{
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '0.8rem',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '40px' }} />
          <col style={{ width: '40px' }} />
          <col style={{ width: '20px' }} />
          <col />
        </colgroup>
        <tbody>
          {fileNoteContent && (
            <tr>
              <td colSpan={4} style={{ padding: '0.5rem 1rem' }}>
                {fileNoteContent}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            let bgColor = 'transparent';
            if (row.type === 'add') bgColor = 'rgba(63, 185, 80, 0.15)';
            if (row.type === 'delete') bgColor = 'rgba(248, 81, 73, 0.15)';
            if (row.type === 'hunk-header') bgColor = 'rgba(56, 139, 253, 0.15)';

            // Anchor line notes to this pane only: the same path and line
            // number can hold different content in the other pane.
            const lineNotes =
              notes.filter(
                (n) =>
                  n.target.kind === 'line' &&
                  n.target.bucket === paneMode &&
                  n.target.startNewLineNumber === row.newLineNumber &&
                  row.type !== 'hunk-header',
              ) || [];

            return (
              <React.Fragment key={row.id}>
                <tr style={{ backgroundColor: bgColor }}>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '0 0.5rem',
                      color: '#8b949e',
                      borderRight: '1px solid #30363d',
                      userSelect: 'none',
                    }}
                  >
                    {row.type === 'hunk-header' &&
                    (paneMode === 'working' ? onStageHunk : onUnstageHunk) ? (
                      <button
                        onClick={() =>
                          paneMode === 'working'
                            ? onStageHunk?.(row.hunkId)
                            : onUnstageHunk?.(row.hunkId)
                        }
                        style={{
                          background: 'transparent',
                          color: paneMode === 'working' ? '#3fb950' : '#f85149',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          padding: 0,
                        }}
                      >
                        {paneMode === 'working' ? 'Stage' : 'Unstage'}
                      </button>
                    ) : (
                      row.type !== 'hunk-header' && row.oldLineNumber
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '0 0.5rem',
                      color: '#8b949e',
                      borderRight: '1px solid #30363d',
                      userSelect: 'none',
                    }}
                  >
                    {row.type !== 'hunk-header' && row.newLineNumber}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      padding: '0',
                      color: '#8b949e',
                      borderRight: '1px solid #30363d',
                      userSelect: 'none',
                      position: 'relative',
                    }}
                  >
                    {row.type !== 'hunk-header' && row.newLineNumber !== undefined && (
                      <button
                        onClick={() => setActiveEditorLine(row.newLineNumber!)}
                        style={{
                          background: 'transparent',
                          color: '#8b949e',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0 4px',
                          width: '100%',
                          opacity: 0.5,
                        }}
                        title="Add note"
                      >
                        +
                      </button>
                    )}
                  </td>
                  <td
                    style={{ padding: '0 0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
                    <span
                      style={{
                        color: row.type === 'hunk-header' ? '#79c0ff' : 'inherit',
                      }}
                    >
                      {row.type === 'add' && '+'}
                      {row.type === 'delete' && '-'}
                      {row.type === 'context' && ' '}
                      {row.type === 'hunk-header' ? (
                        row.content
                      ) : (
                        <SyntaxHighlightedLine content={row.content} filePath={file.path} />
                      )}
                    </span>
                  </td>
                </tr>
                {activeEditorLine === row.newLineNumber && (
                  <tr>
                    <td colSpan={4} style={{ padding: '0.2rem 1rem 0.5rem 6.5rem' }}>
                      <NoteEditor
                        onSave={async (val) => {
                          if (val.trim()) {
                            // Close only after the server accepted the note; a
                            // rejection stays in the editor (draft + inline error).
                            await onAddNote?.(
                              {
                                kind: 'line',
                                path: file.path,
                                line: row.newLineNumber!,
                                bucket: paneMode,
                              },
                              val,
                            );
                          }
                          setActiveEditorLine(null);
                        }}
                        onCancel={() => setActiveEditorLine(null)}
                      />
                    </td>
                  </tr>
                )}
                {lineNotes.map((note) => (
                  <tr key={note.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                    <td colSpan={4} style={{ padding: '0.2rem 1rem 0.5rem 6.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <NoteCard
                          note={note}
                          resolveFilePath={resolveFilePath}
                          onUpdate={onUpdateNote}
                          onDelete={onDeleteNote}
                          deleteDisabled={notesDeleteDisabled}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
