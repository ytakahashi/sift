import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { abbreviateFilePath } from '../../presentation/file-list/file-path';
import { FilePathTooltip } from './FilePathTooltip';

interface FilePathLabelProps {
  oldPath?: string;
  path: string;
}

const TOOLTIP_DELAY_MS = 500;

function formatPathLabel(oldPath: string | undefined, path: string): string {
  return oldPath ? `${oldPath} → ${path}` : path;
}

export function FilePathLabel({ oldPath, path }: FilePathLabelProps): ReactElement {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const fullTextMeasureRef = useRef<HTMLSpanElement | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const tooltipId = useId();
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const fullText = formatPathLabel(oldPath, path);

  const clearTooltipTimer = useCallback((): void => {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  }, []);

  const hideTooltip = useCallback((): void => {
    clearTooltipTimer();
    setIsTooltipVisible(false);
  }, [clearTooltipTimer]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const fullTextMeasure = fullTextMeasureRef.current;
    if (!container || !fullTextMeasure) {
      return;
    }

    const updateOverflow = (): void => {
      const nextIsOverflowing = fullTextMeasure.scrollWidth > container.clientWidth;
      setIsOverflowing(nextIsOverflowing);
      if (!nextIsOverflowing) {
        hideTooltip();
      }
    };

    updateOverflow();
    // The window resize listener is the fallback for environments without
    // ResizeObserver. When ResizeObserver is available it already fires on the
    // container's width change (including window resizes), so the listener is
    // redundant there; keeping it is harmless because updateOverflow is
    // idempotent, and it guarantees overflow recalculation everywhere.
    window.addEventListener('resize', updateOverflow);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', updateOverflow);
      };
    }

    // One ResizeObserver per label is acceptable for the file counts produced
    // by realistic diffs (tens to low hundreds of files). Revisit with a shared
    // observer only if much larger lists become common.
    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [fullText, hideTooltip]);

  useEffect(
    () => () => {
      clearTooltipTimer();
    },
    [clearTooltipTimer],
  );

  useEffect(() => {
    if (!isTooltipVisible) {
      return;
    }

    const closeTooltip = (): void => {
      hideTooltip();
    };

    window.addEventListener('resize', closeTooltip);
    window.addEventListener('scroll', closeTooltip, true);
    return () => {
      window.removeEventListener('resize', closeTooltip);
      window.removeEventListener('scroll', closeTooltip, true);
    };
  }, [hideTooltip, isTooltipVisible]);

  const showTooltipAfterDelay = (): void => {
    if (!isOverflowing) {
      return;
    }

    clearTooltipTimer();
    tooltipTimerRef.current = window.setTimeout(() => {
      tooltipTimerRef.current = null;
      setIsTooltipVisible(true);
    }, TOOLTIP_DELAY_MS);
  };

  return (
    <span
      aria-describedby={isTooltipVisible ? tooltipId : undefined}
      className="file-item-path"
      onMouseEnter={showTooltipAfterDelay}
      onMouseLeave={hideTooltip}
      ref={containerRef}
    >
      <span aria-hidden="true" className="file-item-path-measure" ref={fullTextMeasureRef}>
        {fullText}
      </span>
      <span className="file-item-path-visible">
        {oldPath ? (
          <>
            <span className="file-item-old-path">
              {isOverflowing ? abbreviateFilePath(oldPath) : oldPath}
            </span>{' '}
            &rarr; {isOverflowing ? abbreviateFilePath(path) : path}
          </>
        ) : isOverflowing ? (
          abbreviateFilePath(path)
        ) : (
          path
        )}
      </span>
      {isTooltipVisible && (
        <FilePathTooltip anchorRef={containerRef} id={tooltipId} text={fullText} />
      )}
    </span>
  );
}
