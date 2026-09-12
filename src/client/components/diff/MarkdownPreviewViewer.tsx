import {
  Component,
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import rehypeReact from 'rehype-react';
import rehypeSanitize from 'rehype-sanitize';
import remarkRehype from 'remark-rehype';
import {
  assignLineNotesToBlocks,
  buildMarkdownPreviewRows,
  classifyMarkdownBlocks,
  clampBlockRangeToHunks,
  type ClampedNoteRange,
} from '../../../domain/diff/markdown-blocks';
import type { DiffHunk } from '../../../domain/diff/types';
import type { LineNote, NoteBucket, NoteCreateTarget } from '../../../domain/notes/types';
import { formatLineRange } from '../../presentation/notes/line-range';
import { NoteCard } from '../notes/NoteCard';
import { NoteEditor } from '../notes/NoteEditor';
import { createMarkdownProcessor, parseMarkdownBlocks } from './markdown-block-parser';

/**
 * Note affordances for the previewed pane. Grouped into one object because
 * they are only meaningful together: without a path and a bucket the preview
 * cannot address a note target at all.
 */
export interface MarkdownPreviewNoteSupport {
  path: string;
  bucket: NoteBucket;
  /** Live line notes already scoped to the pane being previewed. */
  lineNotes: LineNote[];
  onAddNote?: (target: NoteCreateTarget, body: string) => Promise<void>;
  onUpdateNote?: (id: string, body: string) => Promise<void>;
  onDeleteNote?: (id: string) => Promise<void>;
  /** Disables note Delete buttons while another notes mutation is in flight. */
  deleteDisabled?: boolean;
  /**
   * Reports the block-level "add note" editor so the Source/Preview toggle can
   * protect its draft. Must be referentially stable.
   */
  onCreateEditorOpenChange?: (isOpen: boolean) => void;
  /** Forwarded to every note card for the same reason. Must be stable. */
  onNoteEditorOpenChange?: (noteId: string, isOpen: boolean) => void;
}

export interface MarkdownPreviewViewerProps {
  hunks: DiffHunk[];
  oldLines: string[];
  newLines: string[];
  noteSupport?: MarkdownPreviewNoteSupport;
}

interface EditingNoteRange extends ClampedNoteRange {
  rowKey: string;
}

interface MarkdownPreviewErrorBoundaryProps {
  children: ReactNode;
  resetKeys: readonly unknown[];
}

interface MarkdownPreviewErrorBoundaryState {
  hasError: boolean;
}

const MARKDOWN_PREVIEW_RENDER_ERROR =
  'Unable to render the Markdown preview. Switch to Source and try again.';

const markdownRenderer = createMarkdownProcessor()
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeReact, {
    Fragment,
    jsx,
    jsxs,
    components: {
      a: MarkdownLinkPlaceholder,
      img: MarkdownImagePlaceholder,
    },
  })
  .freeze();

export function MarkdownPreviewViewer(props: MarkdownPreviewViewerProps): ReactElement {
  const { hunks, oldLines, newLines } = props;
  return (
    <MarkdownPreviewErrorBoundary resetKeys={[hunks, oldLines, newLines]}>
      <MarkdownPreviewContent {...props} />
    </MarkdownPreviewErrorBoundary>
  );
}

function MarkdownPreviewContent({
  hunks,
  oldLines,
  newLines,
  noteSupport,
}: MarkdownPreviewViewerProps): ReactElement {
  const [editingRange, setEditingRange] = useState<EditingNoteRange | null>(null);
  const { rows, newBlocks } = useMemo(() => {
    const oldBlocks = classifyMarkdownBlocks(
      parseMarkdownBlocks(oldLines.join('\n')),
      hunks,
      'old',
    );
    const classifiedNewBlocks = classifyMarkdownBlocks(
      parseMarkdownBlocks(newLines.join('\n')),
      hunks,
      'new',
    );
    return {
      newBlocks: classifiedNewBlocks,
      // Clamping depends only on the block and the hunks, so it belongs here
      // rather than in a render pass that also reruns whenever notes change.
      rows: buildMarkdownPreviewRows(classifiedNewBlocks, oldBlocks, hunks).map((row) => ({
        row,
        key: `${row.kind}:${row.block.id}`,
        noteRanges: row.kind === 'new' ? clampBlockRangeToHunks(row.block, hunks) : [],
      })),
    };
  }, [hunks, newLines, oldLines]);

  const lineNotes = noteSupport?.lineNotes;
  const notePlacement = useMemo(
    () => assignLineNotesToBlocks(newBlocks, lineNotes ?? []),
    [lineNotes, newBlocks],
  );

  // The block holding the open editor can disappear when the previewed content
  // is replaced. Deriving the editor from the rows on screen keeps a stale
  // range from disabling every gutter and both view toggles invisibly.
  const activeEditingRange =
    editingRange !== null && rows.some(({ key }) => key === editingRange.rowKey)
      ? editingRange
      : null;

  const onCreateEditorOpenChange = noteSupport?.onCreateEditorOpenChange;
  const isCreateEditorOpen = activeEditingRange !== null;
  useEffect(() => {
    onCreateEditorOpenChange?.(isCreateEditorOpen);
    // Unmounting releases the draft protection the open editor asked for.
    return () => onCreateEditorOpenChange?.(false);
  }, [isCreateEditorOpen, onCreateEditorOpenChange]);

  const renderNoteCard = (note: LineNote): ReactElement => (
    <NoteCard
      key={note.id}
      note={note}
      // A block spans more lines than the note itself, so the card has to state
      // the range it was written against.
      contextLabel={formatLineRange(note.startLine, note.endLine)}
      onUpdate={noteSupport?.onUpdateNote}
      onDelete={noteSupport?.onDeleteNote}
      deleteDisabled={noteSupport?.deleteDisabled}
      onEditorOpenChange={noteSupport?.onNoteEditorOpenChange}
    />
  );

  return (
    <div className="markdown-preview-viewer">
      {rows.map(({ row, key, noteRanges }) => {
        const blockNotes = row.kind === 'new' ? (notePlacement.byBlock.get(row.block) ?? []) : [];
        const highlightedByNote =
          row.kind === 'new' &&
          (lineNotes ?? []).some(
            (note) => note.startLine <= row.block.endLine && row.block.startLine <= note.endLine,
          );
        const isEditing = activeEditingRange?.rowKey === key;

        return (
          <div className="markdown-preview-row" key={key}>
            <div className="markdown-preview-note-gutter">
              {noteSupport?.onAddNote !== undefined &&
                noteRanges.map((range) => (
                  <button
                    aria-label={`Add note for ${formatLineRange(range.startLine, range.endLine)}`}
                    className="markdown-preview-note-button"
                    disabled={isCreateEditorOpen}
                    key={`${range.hunkId}:${range.startLine}:${range.endLine}`}
                    onClick={() => setEditingRange({ ...range, rowKey: key })}
                    title={
                      isCreateEditorOpen
                        ? 'Finish the open note before adding another one.'
                        : `Add note for ${formatLineRange(range.startLine, range.endLine)}`
                    }
                    type="button"
                  >
                    +
                  </button>
                ))}
            </div>
            <div
              className={`markdown-preview-block markdown-preview-block-${row.kind} markdown-preview-block-${row.block.status}${highlightedByNote ? ' markdown-preview-block-note-highlighted' : ''}`}
              data-note-highlighted={highlightedByNote || undefined}
              data-preview-kind={row.kind}
              data-preview-status={row.block.status}
            >
              <MarkdownBlockContent raw={row.block.raw} />
              {blockNotes.length > 0 && (
                <div className="markdown-preview-block-notes">{blockNotes.map(renderNoteCard)}</div>
              )}
              {isEditing && activeEditingRange && noteSupport?.onAddNote !== undefined && (
                <div className="markdown-preview-block-notes">
                  <NoteEditor
                    contextLabel={formatLineRange(
                      activeEditingRange.startLine,
                      activeEditingRange.endLine,
                    )}
                    onSave={async (value) => {
                      if (value.trim()) {
                        // Close only after the server accepted the note; a
                        // rejection stays in the editor (draft + inline error).
                        await noteSupport.onAddNote?.(
                          {
                            kind: 'line',
                            path: noteSupport.path,
                            startLine: activeEditingRange.startLine,
                            endLine: activeEditingRange.endLine,
                            bucket: noteSupport.bucket,
                          },
                          value,
                        );
                      }
                      setEditingRange(null);
                    }}
                    onCancel={() => setEditingRange(null)}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
      {notePlacement.unanchored.length > 0 && (
        // Only reachable when the new side renders no block at all; the notes
        // still belong to this file, so the preview shows them rather than
        // dropping them.
        <div className="markdown-preview-unanchored-notes">
          <p className="markdown-preview-unanchored-caption">
            Notes without a Markdown block to anchor to
          </p>
          {notePlacement.unanchored.map(renderNoteCard)}
        </div>
      )}
    </div>
  );
}

function MarkdownBlockContent({ raw }: { raw: string }): ReactElement {
  // Blocks retain their identity across unrelated source edits. Compile each
  // block independently so unchanged Markdown does not need to be processed again.
  const content = useMemo(() => markdownRenderer.processSync(raw).result, [raw]);
  return <>{content}</>;
}

class MarkdownPreviewErrorBoundary extends Component<
  MarkdownPreviewErrorBoundaryProps,
  MarkdownPreviewErrorBoundaryState
> {
  state: MarkdownPreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_error: unknown): MarkdownPreviewErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: MarkdownPreviewErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      this.props.resetKeys.some((key, index) => key !== previousProps.resetKeys[index])
    ) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="markdown-preview-error" role="alert">
          {MARKDOWN_PREVIEW_RENDER_ERROR}
        </div>
      );
    }
    return this.props.children;
  }
}

function MarkdownLinkPlaceholder({ children, href }: ComponentPropsWithoutRef<'a'>): ReactElement {
  // Repository-controlled links must not navigate the application window or
  // open an ungoverned Electron renderer.
  return (
    <span className="markdown-preview-link-placeholder" title={href}>
      {children}
    </span>
  );
}

function MarkdownImagePlaceholder({ alt }: ComponentPropsWithoutRef<'img'>): ReactElement {
  // Previewing repository content must not initiate requests to arbitrary image URLs.
  return (
    <span
      aria-label={alt ? `Image: ${alt}` : 'Image'}
      className="markdown-preview-image-placeholder"
      role="img"
    >
      {alt ? `[Image: ${alt}]` : '[Image]'}
    </span>
  );
}
