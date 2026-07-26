import React, { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { UnfoldVertical } from 'lucide-react';
import type { BaseDiffViewerProps } from './BaseDiffViewer';
import { findHunkContainingRange } from '../../../domain/notes/resolve-line-note-target';
import { formatLineRange } from '../../presentation/notes/line-range';
import { NoteEditor } from '../notes/NoteEditor';
import { NoteCard } from '../notes/NoteCard';
import { SyntaxHighlightedLine } from './SyntaxHighlightedLine';
import { useFileFullView } from './useFileFullView';

type LineInteraction =
  | { type: 'idle' }
  | { type: 'selecting'; anchor: number }
  | { type: 'editing'; startLine: number; endLine: number };

const RANGE_SELECTION_ERROR = 'Select lines within a single diff hunk.';

export function UnifiedDiffViewer({
  file,
  repoId,
  fileContentReader,
  fullViewToolbarTarget,
  paneMode,
  onStageHunk,
  onUnstageHunk,
  notes = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  notesDeleteDisabled,
  isFileNoteEditorOpen = false,
  onCloseFileNoteEditor,
}: BaseDiffViewerProps): ReactElement {
  const {
    rows,
    isFullView,
    loading: fullViewLoading,
    error: fullViewError,
    showFullView,
  } = useFileFullView(file, repoId, fileContentReader);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<LineInteraction>({ type: 'idle' });
  const [rangeSelectionError, setRangeSelectionError] = useState<string | null>(null);
  const fileNotes = notes.filter((note) => note.kind === 'file');
  const paneLineNotes = notes.filter((note) => note.kind === 'line' && note.bucket === paneMode);
  const canShowFullView =
    paneMode === 'staged' &&
    file.kind === 'text' &&
    file.status !== 'added' &&
    file.status !== 'deleted' &&
    file.hunks.length > 0 &&
    file.newBlobId !== undefined;

  useEffect(() => {
    if (interaction.type !== 'selecting') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setInteraction({ type: 'idle' });
      }
    };
    const handleDocumentClick = (event: MouseEvent): void => {
      const target = event.target;
      const isOwnGutter =
        target instanceof Element &&
        viewerRef.current?.contains(target) === true &&
        target.closest('[data-note-range-gutter="true"]') !== null;
      if (!isOwnGutter) {
        setInteraction({ type: 'idle' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [interaction.type]);

  useEffect(() => {
    if (rangeSelectionError === null) {
      return;
    }
    const timer = window.setTimeout(() => setRangeSelectionError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [rangeSelectionError]);

  const handleGutterClick = (lineNumber: number): void => {
    setRangeSelectionError(null);
    if (interaction.type !== 'selecting') {
      setInteraction({ type: 'selecting', anchor: lineNumber });
      return;
    }

    const startLine = Math.min(interaction.anchor, lineNumber);
    const endLine = Math.max(interaction.anchor, lineNumber);
    if (!findHunkContainingRange(file.hunks, startLine, endLine)) {
      setRangeSelectionError(RANGE_SELECTION_ERROR);
      setInteraction({ type: 'idle' });
      return;
    }
    setInteraction({ type: 'editing', startLine, endLine });
  };

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
      ref={viewerRef}
      className="unified-diff-viewer"
      style={{
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '0.8rem',
      }}
    >
      {rangeSelectionError && (
        <div
          role="alert"
          style={{ color: '#f85149', padding: '0.4rem 1rem', whiteSpace: 'pre-wrap' }}
        >
          {rangeSelectionError}
        </div>
      )}
      {fullViewError && (
        <div
          role="alert"
          style={{ color: '#f85149', padding: '0.4rem 1rem', whiteSpace: 'pre-wrap' }}
        >
          {fullViewError}
        </div>
      )}
      {fullViewToolbarTarget &&
        canShowFullView &&
        !isFullView &&
        createPortal(
          <button
            aria-label={fullViewLoading ? 'Loading entire file' : 'View entire file'}
            className="button file-list-toggle-button"
            disabled={fullViewLoading}
            onClick={showFullView}
            title={fullViewLoading ? 'Loading entire file' : 'View entire file'}
            type="button"
          >
            <UnfoldVertical aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>,
          fullViewToolbarTarget,
        )}
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

            // Anchor line notes to this pane only: the same path and range can
            // hold different content in the other pane.
            const rowLineNumber = row.type === 'hunk-header' ? undefined : row.newLineNumber;
            const highlightedByNote =
              rowLineNumber !== undefined &&
              paneLineNotes.some(
                (note) =>
                  note.kind === 'line' &&
                  note.startLine <= rowLineNumber &&
                  rowLineNumber <= note.endLine,
              );
            const endingLineNotes =
              rowLineNumber === undefined
                ? []
                : paneLineNotes.filter(
                    (note) => note.kind === 'line' && note.endLine === rowLineNumber,
                  );
            const isRangeAnchor =
              interaction.type === 'selecting' && interaction.anchor === rowLineNumber;
            const isEditingRange =
              interaction.type === 'editing' &&
              rowLineNumber !== undefined &&
              interaction.startLine <= rowLineNumber &&
              rowLineNumber <= interaction.endLine;
            const rangeIndicatorColor = isRangeAnchor
              ? '#d29922'
              : isEditingRange
                ? '#58a6ff'
                : highlightedByNote
                  ? '#3fb950'
                  : undefined;

            return (
              <React.Fragment key={row.id}>
                <tr
                  data-new-line-number={rowLineNumber}
                  data-note-highlighted={highlightedByNote || undefined}
                  data-range-anchor={isRangeAnchor || undefined}
                  data-range-editing={isEditingRange || undefined}
                  style={{
                    backgroundColor: bgColor,
                    boxShadow: rangeIndicatorColor
                      ? `inset 3px 0 0 ${rangeIndicatorColor}`
                      : undefined,
                  }}
                >
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
                    {row.type !== 'hunk-header' &&
                      row.origin === 'hunk' &&
                      row.newLineNumber !== undefined && (
                        <button
                          aria-label={`Select line ${row.newLineNumber} for note`}
                          data-note-range-gutter="true"
                          onClick={() => handleGutterClick(row.newLineNumber!)}
                          style={{
                            background: 'transparent',
                            color: '#8b949e',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0 4px',
                            width: '100%',
                            opacity: 0.5,
                          }}
                          title={
                            interaction.type === 'selecting'
                              ? `Click to end the note range at line ${row.newLineNumber}`
                              : `Click to start a note at line ${row.newLineNumber} (click another line for a range)`
                          }
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
                {interaction.type === 'editing' && interaction.endLine === row.newLineNumber && (
                  <tr>
                    <td colSpan={4} style={{ padding: '0.2rem 1rem 0.5rem 6.5rem' }}>
                      <NoteEditor
                        contextLabel={formatLineRange(interaction.startLine, interaction.endLine)}
                        onSave={async (val) => {
                          if (val.trim()) {
                            // Close only after the server accepted the note; a
                            // rejection stays in the editor (draft + inline error).
                            await onAddNote?.(
                              {
                                kind: 'line',
                                path: file.path,
                                startLine: interaction.startLine,
                                endLine: interaction.endLine,
                                bucket: paneMode,
                              },
                              val,
                            );
                          }
                          setInteraction({ type: 'idle' });
                        }}
                        onCancel={() => setInteraction({ type: 'idle' })}
                      />
                    </td>
                  </tr>
                )}
                {endingLineNotes.map((note) => (
                  <tr key={note.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                    <td colSpan={4} style={{ padding: '0.2rem 1rem 0.5rem 6.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <NoteCard
                          note={note}
                          contextLabel={
                            note.kind === 'line'
                              ? formatLineRange(note.startLine, note.endLine)
                              : undefined
                          }
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
