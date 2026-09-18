import { describe, expect, it } from 'vitest';
import { moveItem, resolveDropPosition } from './reorder';

describe('moveItem', () => {
  it('moves an earlier item after a later target without mutating the input', () => {
    // Given
    const items = ['a', 'b', 'c'];

    // When
    const result = moveItem(items, (item) => item, 'a', 'c', 'after');

    // Then
    expect(result).toEqual(['b', 'c', 'a']);
    expect(result).not.toBe(items);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('moves an earlier item before a non-adjacent later target', () => {
    // Given
    const items = ['a', 'b', 'c'];

    // When
    const result = moveItem(items, (item) => item, 'a', 'c', 'before');

    // Then
    expect(result).toEqual(['b', 'a', 'c']);
  });

  it('moves a later item before an earlier target', () => {
    // Given
    const items = ['a', 'b', 'c'];

    // When
    const result = moveItem(items, (item) => item, 'c', 'a', 'before');

    // Then
    expect(result).toEqual(['c', 'a', 'b']);
  });

  it('returns the input when the source is already immediately before the target', () => {
    // Given
    const items = ['a', 'b', 'c'];

    // When
    const result = moveItem(items, (item) => item, 'a', 'b', 'before');

    // Then
    expect(result).toBe(items);
  });

  it('returns the input when the source is already immediately after the target', () => {
    // Given
    const items = ['a', 'b', 'c'];

    // When
    const result = moveItem(items, (item) => item, 'b', 'a', 'after');

    // Then
    expect(result).toBe(items);
  });

  it('returns the input when source and target keys are the same', () => {
    // Given
    const items = ['a', 'b'];

    // When
    const result = moveItem(items, (item) => item, 'a', 'a', 'before');

    // Then
    expect(result).toBe(items);
  });

  it.each([
    { sourceKey: 'missing', targetKey: 'a' },
    { sourceKey: 'a', targetKey: 'missing' },
  ])(
    'returns the input when $sourceKey -> $targetKey has a missing key',
    ({ sourceKey, targetKey }) => {
      // Given
      const items = ['a', 'b'];

      // When
      const result = moveItem(items, (item) => item, sourceKey, targetKey, 'before');

      // Then
      expect(result).toBe(items);
    },
  );

  it('uses the key selector to move objects', () => {
    // Given
    const first = { id: 'a', name: 'First' };
    const second = { id: 'b', name: 'Second' };
    const third = { id: 'c', name: 'Third' };
    const items = [first, second, third];

    // When
    const result = moveItem(items, (item) => item.id, 'c', 'a', 'after');

    // Then
    expect(result).toEqual([first, third, second]);
  });
});

describe('resolveDropPosition', () => {
  it.each([
    { expected: 'before', pointer: 109 },
    { expected: 'after', pointer: 110 },
    { expected: 'after', pointer: 111 },
  ] as const)('returns $expected for pointer $pointer', ({ expected, pointer }) => {
    // Given
    const start = 100;
    const size = 20;

    // When
    const result = resolveDropPosition(pointer, start, size);

    // Then
    expect(result).toBe(expected);
  });
});
