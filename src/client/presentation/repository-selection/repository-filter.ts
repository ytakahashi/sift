/** Minimal shape shared by resolved and invalid repositories. */
export interface RepositoryFilterTarget {
  name: string;
  path: string;
}

function normalizeRepositoryFilterText(value: string): string {
  return value.normalize('NFC').toLowerCase();
}

export function normalizeRepositoryFilterQuery(query: string): string {
  return normalizeRepositoryFilterText(query.trim());
}

export function matchesRepositoryFilter(
  repository: RepositoryFilterTarget,
  normalizedQuery: string,
): boolean {
  if (normalizedQuery.length === 0) {
    return true;
  }

  return (
    normalizeRepositoryFilterText(repository.name).includes(normalizedQuery) ||
    normalizeRepositoryFilterText(repository.path).includes(normalizedQuery)
  );
}
