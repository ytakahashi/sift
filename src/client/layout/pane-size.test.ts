import { describe, expect, it } from 'vitest';
import {
  clampSidebarWidth,
  clampWorkingPanelHeight,
  PANEL_MIN_HEIGHT_PX,
  SIDEBAR_MIN_WIDTH_PX,
} from './pane-size';

describe('pane-size', () => {
  it('clamps sidebar width to min and max bounds', () => {
    // Given: a main area where the maximum sidebar width is 640px
    const appMainWidthPx = 1000;

    // When: requesting widths below minimum and above maximum
    const belowMin = clampSidebarWidth(100, appMainWidthPx);
    const aboveMax = clampSidebarWidth(900, appMainWidthPx);

    // Then: the result is clamped to the defined limits
    expect(belowMin).toBe(SIDEBAR_MIN_WIDTH_PX);
    // appMainWidthPx - DIFF_VIEW_MIN_WIDTH_PX = 1000 - 360 = 640
    expect(aboveMax).toBe(640);
  });

  it('clamps working panel height to min and max bounds', () => {
    // Given: a sidebar with total height 500px
    const sidebarHeightPx = 500;

    // When: requesting heights below minimum and above maximum
    const belowMin = clampWorkingPanelHeight(50, sidebarHeightPx);
    const aboveMax = clampWorkingPanelHeight(420, sidebarHeightPx);

    // Then: the result is clamped to the defined limits
    expect(belowMin).toBe(PANEL_MIN_HEIGHT_PX);
    // sidebarHeightPx - PANEL_MIN_HEIGHT_PX = 500 - 120 = 380
    expect(aboveMax).toBe(380);
  });

  it('returns minimum height when sidebar is smaller than two panels', () => {
    // Given: a very small sidebar where min + min cannot fit
    const sidebarHeightPx = 200;

    // When: requesting any larger height
    const height = clampWorkingPanelHeight(180, sidebarHeightPx);

    // Then: max falls back to min to prevent negative space
    expect(height).toBe(PANEL_MIN_HEIGHT_PX);
  });
});
