import React, { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { UnfoldVertical } from 'lucide-react';
import type { BaseDiffViewerProps } from './BaseDiffViewer';
import { isLiveNote } from '../../../domain/notes/note-staleness';
import { findHunkContainingRange } from '../../../domain/notes/resolve-line-note-target';
import { formatLineRange } from '../../presentation/notes/line-range';
import { NoteEditor } from '../notes/NoteEditor';
import { NoteCard } from '../notes/NoteCard';
import { MarkdownPreviewViewer } from './MarkdownPreviewViewer';
import { SyntaxHighlightedLine } from './SyntaxHighlightedLine';
import { getLanguageFromPath } from './language';
import { useFileFullView } from './useFileFullView';
import { useMarkdownPreview } from './useMarkdownPreview';

type LineInteraction =
  | { type: 'idle' }
  | { type: 'selecting'; anchor: number }
  | { type: 'editing'; startLine: number; endLine: number };

const RANGE_SELECTION_ERROR = 'Select lines within a single diff hunk.';

export function UnifiedDiffViewer({
  blobContentReader,
  diffToolbarTarget,
  file,
  repoId,
  fileContentReader,
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
  const markdownPreview = useMarkdownPreview(file, repoId, fileContentReader, blobContentReader);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<LineInteraction>({ type: 'idle' });
  const [rangeSelectionError, setRangeSelectionError] = useState<string | null>(null);
  const fileNotes = notes.filter((note) => note.kind === 'file' && isLiveNote(note));
  const paneLineNotes = notes.filter(
    (note) => note.kind === 'line' && note.bucket === paneMode && isLiveNote(note),
  );
  // Stale notes lose their line anchor — the recorded range no longer describes
  // what is on screen — but keep the pane they were written in, so they show up
  // once, in the file-level area, instead of on a line that moved on.
  const staleNotes = notes.filter(
    (note) => !isLiveNote(note) && (note.kind === 'file' || note.bucket === paneMode),
  );
  const canShowFullView =
    paneMode === 'staged' &&
    file.kind === 'text' &&
    file.status !== 'added' &&
    file.status !== 'deleted' &&
    file.hunks.length > 0 &&
    file.newBlobId !== undefined;
  const canShowMarkdownPreview =
    paneMode === 'staged' &&
    file.kind === 'text' &&
    file.status === 'modified' &&
    file.oldBlobId !== undefined &&
    file.newBlobId !== undefined &&
    getLanguageFromPath(file.path) === 'markdown';
  const isMarkdownPreviewSelected = markdownPreview.mode !== 'source';
  const isLineNoteEditorOpen = interaction.type === 'editing';
  const lineNoteEditorSwitchTitle = isLineNoteEditorOpen
    ? 'Finish editing the line note before switching views.'
    : undefined;

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
    if (!isFileNoteEditorOpen && fileNotes.length === 0 && staleNotes.length === 0) {
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
        {staleNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            // A stale line note is no longer rendered next to its lines, so it
            // has to say which range it was written against.
            contextLabel={
              note.kind === 'line' ? formatLineRange(note.startLine, note.endLine) : undefined
            }
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
      {!isMarkdownPreviewSelected && rangeSelectionError && (
        <div
          role="alert"
          style={{ color: '#f85149', padding: '0.4rem 1rem', whiteSpace: 'pre-wrap' }}
        >
          {rangeSelectionError}
        </div>
      )}
      {!isMarkdownPreviewSelected && fullViewError && (
        <div
          role="alert"
          style={{ color: '#f85149', padding: '0.4rem 1rem', whiteSpace: 'pre-wrap' }}
        >
          {fullViewError}
        </div>
      )}
      {markdownPreview.mode === 'error' && (
        <div className="markdown-preview-error" role="alert">
          {markdownPreview.error}
        </div>
      )}
      {diffToolbarTarget &&
        canShowMarkdownPreview &&
        createPortal(
          <div aria-label="Markdown view" className="markdown-view-toggle" role="group">
            <button
              aria-pressed={!isMarkdownPreviewSelected}
              className="button markdown-view-toggle-button"
              onClick={markdownPreview.showSource}
              type="button"
            >
              Source
            </button>
            <button
              aria-pressed={isMarkdownPreviewSelected}
              className="button markdown-view-toggle-button"
              disabled={
                markdownPreview.mode === 'loading' ||
                (!isMarkdownPreviewSelected && isLineNoteEditorOpen)
              }
              onClick={markdownPreview.showPreview}
              title={!isMarkdownPreviewSelected ? lineNoteEditorSwitchTitle : undefined}
              type="button"
            >
              Preview
            </button>
          </div>,
          diffToolbarTarget,
        )}
      {diffToolbarTarget &&
        canShowFullView &&
        !isFullView &&
        !isMarkdownPreviewSelected &&
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
          diffToolbarTarget,
        )}
      {/* File notes stay at one tree position so their editor draft survives
          Source/Preview switches without blocking navigation. */}
      {fileNoteContent && <div style={{ padding: '0.5rem 1rem 0' }}>{fileNoteContent}</div>}
      {markdownPreview.mode === 'loading' && (
        <div className="markdown-preview-status" role="status">
          Loading Markdown preview…
        </div>
      )}
      {markdownPreview.mode === 'ready' && (
        <MarkdownPreviewViewer
          hunks={file.hunks}
          oldLines={markdownPreview.oldLines}
          newLines={markdownPreview.newLines}
        />
      )}
      {/* Keep Source and Preview exclusive while Preview is loading or has
          failed; showing the table would expose Source-only line-note
          interactions under a selected Preview mode. */}
      {markdownPreview.mode === 'source' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '40px' }} />
            <col style={{ width: '40px' }} />
            <col style={{ width: '20px' }} />
            <col />
          </colgroup>
          <tbody>
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
                      className="diff-selection-decoration"
                      style={{
                        textAlign: 'right',
                        padding: '0 0.5rem',
                        color: '#8b949e',
                        borderRight: '1px solid #30363d',
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
                      className="diff-selection-decoration"
                      style={{
                        textAlign: 'right',
                        padding: '0 0.5rem',
                        color: '#8b949e',
                        borderRight: '1px solid #30363d',
                      }}
                    >
                      {row.type !== 'hunk-header' && row.newLineNumber}
                    </td>
                    <td
                      className="diff-selection-decoration"
                      style={{
                        textAlign: 'center',
                        padding: '0',
                        color: '#8b949e',
                        borderRight: '1px solid #30363d',
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
                      style={{
                        padding: '0 0.5rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      <span
                        style={{
                          color: row.type === 'hunk-header' ? '#79c0ff' : 'inherit',
                        }}
                      >
                        {row.type !== 'hunk-header' && (
                          // Markers stay exposed to assistive technology while this class excludes
                          // them from text selection, so copied diff lines contain source text only.
                          <span className="diff-line-marker diff-selection-decoration">
                            {row.type === 'add' ? '+' : row.type === 'delete' ? '-' : ' '}
                          </span>
                        )}
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
      )}
    </div>
  );
}
