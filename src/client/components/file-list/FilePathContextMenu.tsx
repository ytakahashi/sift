import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

interface FilePathContextMenuProps {
  // Null when the repository root is not yet available; the absolute path
  // cannot be resolved in that case, but the relative path is still copyable.
  absolutePath: string | null;
  clientX: number;
  clientY: number;
  onClose: () => void;
  relativePath: string;
}

interface MenuPosition {
  left: number;
  top: number;
}

const VIEWPORT_MARGIN_PX = 8;
const COPY_FEEDBACK_DURATION_MS = 2000;
const COPY_TOOLTIP_RESERVED_HEIGHT_PX = 32;

export function FilePathContextMenu({
  absolutePath,
  clientX,
  clientY,
  onClose,
  relativePath,
}: FilePathContextMenuProps): ReactElement {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({
    left: clientX,
    top: clientY,
  });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const bounds = menu.getBoundingClientRect();
    const left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(clientX, window.innerWidth - bounds.width - VIEWPORT_MARGIN_PX),
    );
    const top = Math.max(
      VIEWPORT_MARGIN_PX + COPY_TOOLTIP_RESERVED_HEIGHT_PX,
      Math.min(clientY, window.innerHeight - bounds.height - VIEWPORT_MARGIN_PX),
    );

    setPosition({ left, top });
    firstItemRef.current?.focus();
  }, [clientX, clientY]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(onClose, COPY_FEEDBACK_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [copied, onClose]);

  const copyPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to copy file path:', error.message);
      }
      onClose();
    }
  };

  return createPortal(
    <div
      aria-label="File path actions"
      className="file-path-context-menu"
      ref={menuRef}
      role="menu"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      {copied && (
        <span aria-live="polite" className="file-path-copy-tooltip" role="status">
          Copied!
        </span>
      )}
      <button
        className="file-path-context-menu-item"
        disabled={copied}
        onClick={() => void copyPath(relativePath)}
        ref={firstItemRef}
        role="menuitem"
        type="button"
      >
        Copy Relative Path
      </button>
      <button
        className="file-path-context-menu-item"
        disabled={copied || absolutePath === null}
        onClick={() => {
          if (absolutePath !== null) {
            void copyPath(absolutePath);
          }
        }}
        role="menuitem"
        type="button"
      >
        Copy Absolute Path
      </button>
    </div>,
    document.body,
  );
}
