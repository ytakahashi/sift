import { describe, expect, it } from 'vitest';
import { matchesRepositoryFilter, normalizeRepositoryFilterQuery } from './repository-filter';

const repositories = [
  { name: 'Sift', path: '/Users/dev/projects/sift' },
  { name: 'Documentation', path: '/Users/dev/projects/sift-docs' },
  { name: 'Website', path: '/Users/dev/projects/website' },
];

describe('normalizeRepositoryFilterQuery', () => {
  it('trims surrounding whitespace and converts the query to lowercase', () => {
    // Given
    const query = '  SIFT-Docs  ';

    // When
    const result = normalizeRepositoryFilterQuery(query);

    // Then
    expect(result).toBe('sift-docs');
  });

  it('normalizes a whitespace-only query to an empty query', () => {
    // Given
    const query = '   ';

    // When
    const result = normalizeRepositoryFilterQuery(query);

    // Then
    expect(result).toBe('');
  });

  it('normalizes canonically equivalent Unicode text to NFC', () => {
    // Given: the query contains a decomposed e followed by a combining acute accent.
    const query = 'Cafe\u0301';

    // When
    const result = normalizeRepositoryFilterQuery(query);

    // Then
    expect(result).toBe('caf\u00e9');
  });
});

describe('matchesRepositoryFilter', () => {
  it('matches every repository when the query is empty', () => {
    // Given: callers filter rows individually, so an empty query means no filter.
    const normalizedQuery = normalizeRepositoryFilterQuery('   ');

    // When
    const result = matchesRepositoryFilter(repositories[0], normalizedQuery);

    // Then
    expect(result).toBe(true);
  });

  it('matches a repository name without distinguishing case', () => {
    // Given
    const repository = repositories[0];
    const normalizedQuery = normalizeRepositoryFilterQuery('IFT');

    // When
    const result = matchesRepositoryFilter(repository, normalizedQuery);

    // Then
    expect(result).toBe(true);
  });

  it('matches a substring in the repository path', () => {
    // Given
    const repository = repositories[1];
    const normalizedQuery = normalizeRepositoryFilterQuery('projects/sift-docs');

    // When
    const result = matchesRepositoryFilter(repository, normalizedQuery);

    // Then
    expect(result).toBe(true);
  });

  it('matches canonically equivalent Unicode text in a repository path', () => {
    // Given: filesystem paths may use a decomposed representation of accented characters.
    const repository = { name: 'docs', path: '/repos/Cafe\u0301/docs' };
    const normalizedQuery = normalizeRepositoryFilterQuery('caf\u00e9');

    // When
    const result = matchesRepositoryFilter(repository, normalizedQuery);

    // Then
    expect(result).toBe(true);
  });

  it('does not match a query absent from the repository name and path', () => {
    // Given
    const repository = repositories[2];
    const normalizedQuery = normalizeRepositoryFilterQuery('not-found');

    // When
    const result = matchesRepositoryFilter(repository, normalizedQuery);

    // Then
    expect(result).toBe(false);
  });

  it('does not match fields outside name and path', () => {
    // Given: invalid repositories have a reason, but it is not part of the filter target.
    const repository = {
      name: 'missing-repo',
      path: '/repos/missing-repo',
      reason: 'Permission denied',
    };
    const normalizedQuery = normalizeRepositoryFilterQuery('permission');

    // When
    const result = matchesRepositoryFilter(repository, normalizedQuery);

    // Then
    expect(result).toBe(false);
  });
});
