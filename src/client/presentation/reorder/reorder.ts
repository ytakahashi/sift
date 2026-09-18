export type DropPosition = 'before' | 'after';

/**
 * Moves the item identified by `sourceKey` next to the item identified by
 * `targetKey` without mutating `items`.
 *
 * Keys must be unique within `items`. When either key is missing or the item
 * is already at the requested position, the original array reference is
 * returned so state owners can skip an update.
 */
export function moveItem<T, K>(
  items: T[],
  keyOf: (item: T) => K,
  sourceKey: K,
  targetKey: K,
  position: DropPosition,
): T[];
export function moveItem<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
  sourceKey: K,
  targetKey: K,
  position: DropPosition,
): readonly T[];
export function moveItem<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
  sourceKey: K,
  targetKey: K,
  position: DropPosition,
): readonly T[] {
  if (Object.is(sourceKey, targetKey)) {
    return items;
  }

  const sourceIndex = items.findIndex((item) => Object.is(keyOf(item), sourceKey));
  const targetIndex = items.findIndex((item) => Object.is(keyOf(item), targetKey));
  if (sourceIndex === -1 || targetIndex === -1) {
    return items;
  }

  const alreadyBefore = position === 'before' && sourceIndex === targetIndex - 1;
  const alreadyAfter = position === 'after' && sourceIndex === targetIndex + 1;
  if (alreadyBefore || alreadyAfter) {
    return items;
  }

  const result = [...items];
  const removedItems = result.splice(sourceIndex, 1);
  const targetIndexWithoutSource = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const insertIndex =
    position === 'before' ? targetIndexWithoutSource : targetIndexWithoutSource + 1;
  result.splice(insertIndex, 0, ...removedItems);
  return result;
}

/** Decides which half of a one-dimensional box contains the pointer. */
export function resolveDropPosition(pointer: number, start: number, size: number): DropPosition {
  return pointer < start + size / 2 ? 'before' : 'after';
}
