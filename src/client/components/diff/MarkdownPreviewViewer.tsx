import {
  Component,
  Fragment,
  useMemo,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import rehypeReact from 'rehype-react';
import rehypeSanitize from 'rehype-sanitize';
import remarkRehype from 'remark-rehype';
import {
  buildMarkdownPreviewRows,
  classifyMarkdownBlocks,
} from '../../../domain/diff/markdown-blocks';
import type { DiffHunk } from '../../../domain/diff/types';
import { createMarkdownProcessor, parseMarkdownBlocks } from './markdown-block-parser';

export interface MarkdownPreviewViewerProps {
  hunks: DiffHunk[];
  oldLines: string[];
  newLines: string[];
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

export function MarkdownPreviewViewer({
  hunks,
  oldLines,
  newLines,
}: MarkdownPreviewViewerProps): ReactElement {
  return (
    <MarkdownPreviewErrorBoundary resetKeys={[hunks, oldLines, newLines]}>
      <MarkdownPreviewContent hunks={hunks} oldLines={oldLines} newLines={newLines} />
    </MarkdownPreviewErrorBoundary>
  );
}

function MarkdownPreviewContent({
  hunks,
  oldLines,
  newLines,
}: MarkdownPreviewViewerProps): ReactElement {
  const rows = useMemo(() => {
    const oldBlocks = classifyMarkdownBlocks(
      parseMarkdownBlocks(oldLines.join('\n')),
      hunks,
      'old',
    );
    const newBlocks = classifyMarkdownBlocks(
      parseMarkdownBlocks(newLines.join('\n')),
      hunks,
      'new',
    );
    return buildMarkdownPreviewRows(newBlocks, oldBlocks, hunks);
  }, [hunks, newLines, oldLines]);

  return (
    <div className="markdown-preview-viewer">
      {rows.map((row) => (
        <div
          className={`markdown-preview-block markdown-preview-block-${row.kind} markdown-preview-block-${row.block.status}`}
          data-preview-kind={row.kind}
          data-preview-status={row.block.status}
          key={`${row.kind}:${row.block.id}`}
        >
          <MarkdownBlockContent raw={row.block.raw} />
        </div>
      ))}
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
