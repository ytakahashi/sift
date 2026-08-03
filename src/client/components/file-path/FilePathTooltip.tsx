import { useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface FilePathTooltipProps {
  anchorRef: RefObject<HTMLElement | null>;
  id: string;
  text: string;
}

interface TooltipPosition {
  left: number;
  top: number;
}

const VIEWPORT_MARGIN_PX = 8;
const TOOLTIP_GAP_PX = 6;

export function FilePathTooltip({ anchorRef, id, text }: FilePathTooltipProps): ReactElement {
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<TooltipPosition>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) {
      return;
    }

    const anchorBounds = anchor.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    const centeredLeft = anchorBounds.left + anchorBounds.width / 2 - tooltipBounds.width / 2;
    const left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(centeredLeft, window.innerWidth - tooltipBounds.width - VIEWPORT_MARGIN_PX),
    );
    const hasRoomBelow =
      anchorBounds.bottom + TOOLTIP_GAP_PX + tooltipBounds.height + VIEWPORT_MARGIN_PX <=
      window.innerHeight;
    const top = hasRoomBelow
      ? anchorBounds.bottom + TOOLTIP_GAP_PX
      : Math.max(VIEWPORT_MARGIN_PX, anchorBounds.top - tooltipBounds.height - TOOLTIP_GAP_PX);

    setPosition({ left, top });
  }, [anchorRef]);

  return createPortal(
    <span
      className="file-path-tooltip"
      id={id}
      ref={tooltipRef}
      role="tooltip"
      style={{ left: position.left, top: position.top }}
    >
      {text}
    </span>,
    document.body,
  );
}
