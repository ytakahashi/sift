import type { CallToolResult } from '@modelcontextprotocol/server';
import type { ResolvedRepository } from '../domain/repository/repository';
import type { NotesApiCompatibility } from './notes-compatibility';
import {
  describeCapabilityMissing,
  describeIncompatibleProduct,
  describePortResolutionFailure,
  describeRepoRootResolutionFailure,
  describeRepositoryLookupFailure,
  describeUnreachable,
  describeUnregisteredRepository,
} from './notes-tool-guidance';
import { errorResult } from './notes-tool-results';
import type { RepoRootResolver } from './repo-target';

export interface ToolTargetOptions {
  /** The `--repo`/cwd candidate path `repoRootResolver` resolves, for error messages only. */
  repoPath: string;
  repoRootResolver: RepoRootResolver;
  findRegisteredRepositoryByPath: (path: string) => Promise<ResolvedRepository | null>;
  resolvePort: () => number;
  checkNotesApiCompatibility: (port: number) => Promise<NotesApiCompatibility>;
}

type ToolTarget =
  { ok: true; repoId: string; port: number } | { ok: false; result: CallToolResult };

export type ResolveToolTarget = () => Promise<ToolTarget>;

function describeIncompatibility(
  compat: Exclude<NotesApiCompatibility, { kind: 'compatible' }>,
): string {
  switch (compat.kind) {
    case 'unreachable':
      return describeUnreachable();
    case 'incompatible-product':
      return describeIncompatibleProduct();
    case 'capability-missing':
      return describeCapabilityMissing();
  }
}

/**
 * Shared pre-call sequence for every tool: resolve the git root (lazily,
 * cached after the first success), look up the repoId fresh on every call
 * (never cached; a `sift add` after this process started must take effect
 * without a restart), and probe server compatibility before ever touching
 * the Notes API.
 */
export function createToolTargetResolver(options: ToolTargetOptions): ResolveToolTarget {
  return async () => {
    let repoRoot: string;
    try {
      repoRoot = options.repoRootResolver.resolve();
    } catch (error: unknown) {
      return {
        ok: false,
        result: errorResult(describeRepoRootResolutionFailure(options.repoPath, error)),
      };
    }

    let registered: ResolvedRepository | null;
    try {
      registered = await options.findRegisteredRepositoryByPath(repoRoot);
    } catch (error: unknown) {
      return {
        ok: false,
        result: errorResult(describeRepositoryLookupFailure(error)),
      };
    }
    if (!registered) {
      return { ok: false, result: errorResult(describeUnregisteredRepository(repoRoot)) };
    }

    let port: number;
    try {
      port = options.resolvePort();
    } catch (error: unknown) {
      return {
        ok: false,
        result: errorResult(describePortResolutionFailure(error)),
      };
    }
    const compat = await options.checkNotesApiCompatibility(port);
    if (compat.kind !== 'compatible') {
      return { ok: false, result: errorResult(describeIncompatibility(compat)) };
    }

    return { ok: true, repoId: registered.id, port };
  };
}
