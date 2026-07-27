/**
 * The commit-ish the repository's working tree is currently on.
 *
 * `unknown` is part of the model because HEAD is reported alongside diff data
 * for display purposes only. Readers follow the same policy as the diff itself
 * (see `RepositoryDiffProviderOptions`): a Git failure degrades the result
 * instead of failing the whole read, and consumers render nothing for it.
 *
 * A branch that has no commit yet (unborn HEAD) is still a `branch`; only a
 * genuinely detached HEAD reports a revision.
 */
export type HeadRef =
  | { type: 'branch'; name: string }
  | { type: 'detached'; revision: string }
  | { type: 'unknown' };
