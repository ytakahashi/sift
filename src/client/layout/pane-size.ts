export const SIDEBAR_MIN_WIDTH_PX = 220;
export const DIFF_VIEW_MIN_WIDTH_PX = 360;
export const PANEL_MIN_HEIGHT_PX = 120;

export function clampSidebarWidth(widthPx: number, appMainWidthPx: number): number {
  const maxWidthPx = Math.max(SIDEBAR_MIN_WIDTH_PX, appMainWidthPx - DIFF_VIEW_MIN_WIDTH_PX);
  return Math.min(Math.max(widthPx, SIDEBAR_MIN_WIDTH_PX), maxWidthPx);
}

export function clampWorkingPanelHeight(heightPx: number, sidebarHeightPx: number): number {
  const maxHeightPx = Math.max(PANEL_MIN_HEIGHT_PX, sidebarHeightPx - PANEL_MIN_HEIGHT_PX);
  return Math.min(Math.max(heightPx, PANEL_MIN_HEIGHT_PX), maxHeightPx);
}
