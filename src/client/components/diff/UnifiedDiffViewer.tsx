import React, { useEffect, useMemo, useState } from 'react';
import type { BaseDiffViewerProps } from './BaseDiffViewer';
import { DiffViewModelBuilder } from '../../../domain/diff/diff-view-model-builder';
import { NoteEditor } from '../notes/NoteEditor';
import { SyntaxHighlightedLine } from './SyntaxHighlightedLine';
import { formatNoteForClipboard } from '../../../domain/notes/format';

export function UnifiedDiffViewer({
  file,
  paneMode,
  onStageHunk,
  onUnstageHunk,
  notes = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  resolveFilePath,
}: BaseDiffViewerProps) {
  const rows = useMemo(() => DiffViewModelBuilder.buildUnified(file.hunks), [file.hunks]);
  const [activeEditorLine, setActiveEditorLine] = useState<number | null>(null);
  const [activeEditingNoteId, setActiveEditingNoteId] = useState<string | null>(null);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Auto-clear the "Copied!" feedback after 2 seconds
  useEffect(() => {
    if (copiedNoteId !== null) {
      const timer = setTimeout(() => {
        setCopiedNoteId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedNoteId]);

  if (file.kind !== 'text') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>
        {file.kind === 'binary' || file.kind === 'image'
          ? 'Binary file changed'
          : 'Submodule changed'}
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
          {rows.map((row) => {
            let bgColor = 'transparent';
            if (row.type === 'add') bgColor = 'rgba(63, 185, 80, 0.15)';
            if (row.type === 'delete') bgColor = 'rgba(248, 81, 73, 0.15)';
            if (row.type === 'hunk-header') bgColor = 'rgba(56, 139, 253, 0.15)';

            const lineNotes =
              notes?.filter(
                (n) =>
                  n.target.startNewLineNumber === row.newLineNumber && row.type !== 'hunk-header',
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
                        onSave={(val) => {
                          if (val.trim()) {
                            onAddNote?.(
                              {
                                fileId: file.id,
                                hunkId: row.hunkId,
                                startNewLineNumber: row.newLineNumber!,
                                endNewLineNumber: row.newLineNumber!,
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
                        <div
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#161b22',
                            border: '1px solid #3fb950',
                            borderRadius: '4px',
                          }}
                        >
                          {activeEditingNoteId === note.id ? (
                            /* Edit mode: replace body display with NoteEditor */
                            <NoteEditor
                              initialValue={note.body}
                              onSave={(val) => {
                                if (val.trim()) {
                                  onUpdateNote?.(note.id, val);
                                }
                                setActiveEditingNoteId(null);
                              }}
                              onCancel={() => setActiveEditingNoteId(null)}
                            />
                          ) : (
                            /* View mode: show body and action buttons */
                            <>
                              <div style={{ whiteSpace: 'pre-wrap', color: '#c9d1d9' }}>
                                {note.body}
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.5rem',
                                  marginTop: '0.3rem',
                                  fontSize: '0.75rem',
                                  alignItems: 'center',
                                }}
                              >
                                <button
                                  onClick={() => setActiveEditingNoteId(note.id)}
                                  style={{
                                    background: 'transparent',
                                    color: '#79c0ff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  Edit
                                </button>
                                <div style={{ position: 'relative' }}>
                                  {copiedNoteId === note.id && (
                                    <span
                                      style={{
                                        position: 'absolute',
                                        bottom: 'calc(100% + 4px)',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        backgroundColor: '#373434ff',
                                        color: '#ffffff',
                                        padding: '0.2rem 0.4rem',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap',
                                        animation: 'fadeIn 0.2s ease-in-out',
                                      }}
                                    >
                                      Copied!
                                    </span>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (!resolveFilePath) return;
                                      const text = formatNoteForClipboard(note, resolveFilePath);
                                      void navigator.clipboard.writeText(text).then(() => {
                                        setCopiedNoteId(note.id);
                                      });
                                    }}
                                    style={{
                                      background: 'transparent',
                                      color: '#8b949e',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: 0,
                                    }}
                                  >
                                    Copy
                                  </button>
                                </div>
                                <button
                                  onClick={() => onDeleteNote?.(note.id)}
                                  style={{
                                    background: 'transparent',
                                    color: '#f85149',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
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
