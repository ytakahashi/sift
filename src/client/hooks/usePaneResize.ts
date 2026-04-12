import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { clampSidebarWidth, clampWorkingPanelHeight } from '../layout/pane-size';

type DragTarget = 'sidebar-width' | 'working-height';

interface SplitterProps {
  role: 'separator';
  'aria-label': string;
  'aria-orientation': 'vertical' | 'horizontal';
  className: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

interface UsePaneResizeResult {
  appMainRef: RefObject<HTMLElement | null>;
  sidebarRef: RefObject<HTMLDivElement | null>;
  sidebarStyle: CSSProperties;
  workingPaneStyle: CSSProperties | undefined;
  sidebarSplitterProps: SplitterProps;
  paneSplitterProps: SplitterProps;
}

export function usePaneResize(): UsePaneResizeResult {
  const [sidebarWidthPx, setSidebarWidthPx] = useState<number>(300);
  const [workingPaneHeightPx, setWorkingPaneHeightPx] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const appMainRef = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);

  const stopDrag = useCallback(() => {
    dragTargetRef.current = null;
    setDragTarget(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const currentDragTarget = dragTargetRef.current;
      if (!currentDragTarget) {
        return;
      }

      if (currentDragTarget === 'sidebar-width') {
        const appMain = appMainRef.current;
        if (!appMain) {
          return;
        }
        const appRect = appMain.getBoundingClientRect();
        const widthPx = event.clientX - appRect.left;
        setSidebarWidthPx(clampSidebarWidth(widthPx, appRect.width));
        return;
      }

      const sidebar = sidebarRef.current;
      if (!sidebar) {
        return;
      }
      const sidebarRect = sidebar.getBoundingClientRect();
      const heightPx = event.clientY - sidebarRect.top;
      setWorkingPaneHeightPx(clampWorkingPanelHeight(heightPx, sidebarRect.height));
    };

    const handlePointerEnd = () => {
      if (!dragTargetRef.current) {
        return;
      }
      stopDrag();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [stopDrag]);

  // Keep pane sizes valid if the app is resized after the user has dragged splitters.
  useEffect(() => {
    const clampCurrentLayout = () => {
      const appMain = appMainRef.current;
      if (appMain) {
        const appRect = appMain.getBoundingClientRect();
        setSidebarWidthPx((currentWidthPx) => clampSidebarWidth(currentWidthPx, appRect.width));
      }

      const sidebar = sidebarRef.current;
      if (sidebar) {
        const sidebarRect = sidebar.getBoundingClientRect();
        setWorkingPaneHeightPx((currentHeightPx) =>
          currentHeightPx === null
            ? currentHeightPx
            : clampWorkingPanelHeight(currentHeightPx, sidebarRect.height),
        );
      }
    };

    clampCurrentLayout();
    window.addEventListener('resize', clampCurrentLayout);
    return () => {
      window.removeEventListener('resize', clampCurrentLayout);
    };
  }, []);

  useEffect(() => {
    return () => {
      dragTargetRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  const handleSidebarSplitterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragTargetRef.current = 'sidebar-width';
      setDragTarget('sidebar-width');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [],
  );

  const handlePaneSplitterPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragTargetRef.current = 'working-height';
    setDragTarget('working-height');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  }, []);

  return {
    appMainRef,
    sidebarRef,
    sidebarStyle: { width: `${sidebarWidthPx}px` },
    workingPaneStyle:
      workingPaneHeightPx === null
        ? undefined
        : { flex: '0 0 auto', height: `${workingPaneHeightPx}px` },
    sidebarSplitterProps: {
      role: 'separator',
      'aria-label': 'Resize sidebar and diff panes',
      'aria-orientation': 'vertical',
      className: `pane-splitter pane-splitter-vertical ${
        dragTarget === 'sidebar-width' ? 'is-dragging' : ''
      }`,
      onPointerDown: handleSidebarSplitterPointerDown,
    },
    paneSplitterProps: {
      role: 'separator',
      'aria-label': 'Resize Working and Staged panes',
      'aria-orientation': 'horizontal',
      className: `pane-splitter pane-splitter-horizontal ${
        dragTarget === 'working-height' ? 'is-dragging' : ''
      }`,
      onPointerDown: handlePaneSplitterPointerDown,
    },
  };
}
