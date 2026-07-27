import { describe, expect, it } from 'vitest';
import { toHeadLabel } from './head-label';

describe('toHeadLabel', () => {
  it('labels a branch with its name', () => {
    // Given / When
    const label = toHeadLabel({ type: 'branch', name: 'feature/add-branch-label' });

    // Then
    expect(label).toEqual({
      text: 'feature/add-branch-label',
      // The title carries the full name because CSS truncates long branch names.
      title: 'Branch: feature/add-branch-label',
      detached: false,
    });
  });

  it('marks a detached HEAD in the text as well as the flag', () => {
    // Given / When
    const label = toHeadLabel({ type: 'detached', revision: 'a1b2c3d' });

    // Then
    expect(label).toEqual({
      text: 'a1b2c3d (detached)',
      title: 'Detached HEAD at a1b2c3d',
      detached: true,
    });
  });

  it('returns null when HEAD is unknown', () => {
    // Given / When / Then
    // Git could not report HEAD, so the header shows nothing rather than a guess.
    expect(toHeadLabel({ type: 'unknown' })).toBeNull();
  });

  it('returns null before the first diff read', () => {
    // Given / When / Then
    expect(toHeadLabel(null)).toBeNull();
  });
});
