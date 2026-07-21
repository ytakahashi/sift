import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CopyFeedbackTooltip } from './CopyFeedbackTooltip';

describe('CopyFeedbackTooltip', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when not visible', () => {
    // Given/When: the tooltip is rendered with visible=false
    render(<CopyFeedbackTooltip visible={false} align="center" size="compact" />);

    // Then: no "Copied!" text is present
    expect(screen.queryByText('Copied!')).toBeNull();
  });

  it('renders centered and compact for align=center size=compact', () => {
    // Given/When: the tooltip is rendered with align=center, size=compact
    render(<CopyFeedbackTooltip visible align="center" size="compact" />);

    // Then: it is centered above the trigger with the compact padding
    const tooltip = screen.getByText('Copied!');
    expect(tooltip.style.left).toBe('50%');
    expect(tooltip.style.transform).toBe('translateX(-50%)');
    expect(tooltip.style.bottom).toBe('calc(100% + 4px)');
    expect(tooltip.style.padding).toBe('0.2rem 0.4rem');
    expect(tooltip.style.fontSize).toBe('');
  });

  it('renders end-aligned and comfortable for align=end size=comfortable', () => {
    // Given/When: the tooltip is rendered with align=end, size=comfortable
    render(<CopyFeedbackTooltip visible align="end" size="comfortable" />);

    // Then: it is right-aligned above the trigger with the comfortable padding/fontSize
    const tooltip = screen.getByText('Copied!');
    expect(tooltip.style.right).toBe('0px');
    expect(tooltip.style.bottom).toBe('calc(100% + 8px)');
    expect(tooltip.style.padding).toBe('0.4rem 0.6rem');
    expect(tooltip.style.fontSize).toBe('0.75rem');
  });
});
