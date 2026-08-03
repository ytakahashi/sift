import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { createFilePathCandidates } from '../../presentation/file-list/file-path';
import { FilePathTooltip } from './FilePathTooltip';

interface FilePathLabelProps {
  oldPath?: string;
  path: string;
}

const TOOLTIP_DELAY_MS = 500;

function formatPathLabel(oldPath: string | undefined, path: string): string {
  return oldPath ? `${oldPath} → ${path}` : path;
}

// Keeps the old/new path text apart instead of joining them into one string,
// so rendering never has to split a combined string back apart (a path that
// happens to contain " → " would otherwise be split at the wrong place).
interface PathLabelCandidate {
  measureText: string;
  oldPathText?: string;
  pathText: string;
}

function createPathLabelCandidates(
  oldPath: string | undefined,
  path: string,
): PathLabelCandidate[] {
  const pathCandidates = createFilePathCandidates(path);
  if (!oldPath) {
    return pathCandidates.map((pathText) => ({ measureText: pathText, pathText }));
  }

  const oldPathCandidates = createFilePathCandidates(oldPath);
  const candidateCount = Math.max(oldPathCandidates.length, pathCandidates.length);

  return Array.from({ length: candidateCount }, (_value, index) => {
    const oldPathText = oldPathCandidates[Math.min(index, oldPathCandidates.length - 1)];
    const pathText = pathCandidates[Math.min(index, pathCandidates.length - 1)];
    return { measureText: `${oldPathText} → ${pathText}`, oldPathText, pathText };
  });
}

export function FilePathLabel({ oldPath, path }: FilePathLabelProps): ReactElement {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const fullTextMeasureRef = useRef<HTMLSpanElement | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const tooltipId = useId();
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const fullText = formatPathLabel(oldPath, path);
  const candidates = useMemo(() => createPathLabelCandidates(oldPath, path), [oldPath, path]);
  const [visibleCandidate, setVisibleCandidate] = useState<PathLabelCandidate>(candidates[0]);

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
    const measureContainer = fullTextMeasureRef.current;
    if (!container || !measureContainer) {
      return;
    }

    const updateOverflow = (): void => {
      const candidateMeasures = Array.from(measureContainer.children) as HTMLElement[];
      const fittingCandidateIndex = candidateMeasures.findIndex(
        (candidateMeasure) => candidateMeasure.scrollWidth <= container.clientWidth,
      );
      const selectedCandidateIndex =
        fittingCandidateIndex >= 0 ? fittingCandidateIndex : candidates.length - 1;
      const nextIsOverflowing = candidateMeasures[0]?.scrollWidth > container.clientWidth;
      setVisibleCandidate(candidates[selectedCandidateIndex] ?? candidates[0]);
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
  }, [candidates, hideTooltip]);

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
      className="file-path-label"
      onMouseEnter={showTooltipAfterDelay}
      onMouseLeave={hideTooltip}
      ref={containerRef}
    >
      <span aria-hidden="true" className="file-path-label-measure" ref={fullTextMeasureRef}>
        {candidates.map((candidate, index) => (
          // Keyed by index (not text): the list is positional — updateOverflow
          // matches measured DOM children back to `candidates` by array index.
          <span className="file-path-label-measure-candidate" key={index}>
            {candidate.measureText}
          </span>
        ))}
      </span>
      <span className="file-path-label-visible">
        {oldPath ? (
          <>
            <span className="file-path-label-old">{visibleCandidate.oldPathText}</span> &rarr;{' '}
            {visibleCandidate.pathText}
          </>
        ) : (
          visibleCandidate.pathText
        )}
      </span>
      {isTooltipVisible && (
        <FilePathTooltip anchorRef={containerRef} id={tooltipId} text={fullText} />
      )}
    </span>
  );
}
