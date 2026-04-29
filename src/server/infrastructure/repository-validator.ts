import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { REPOSITORY_ID_PATTERN } from '../../domain/repository/repository';
import type { RepositoryDescriptor } from '../../domain/repository/repository';

const execFileAsync = promisify(execFile);

export interface RepositoryValidationResult {
  error?: string;
  isValid: boolean;
}

export type RepositoryValidator = (
  repository: RepositoryDescriptor,
) => Promise<RepositoryValidationResult>;

export async function validateRepositoryPath(
  repository: RepositoryDescriptor,
): Promise<RepositoryValidationResult> {
  if (!REPOSITORY_ID_PATTERN.test(repository.id)) {
    return {
      error: 'Repository id must contain only lowercase letters, numbers, and hyphens.',
      isValid: false,
    };
  }

  if (!path.isAbsolute(repository.path)) {
    return {
      error: 'Repository path must be an absolute path.',
      isValid: false,
    };
  }

  try {
    const repositoryStat = await stat(repository.path);
    if (!repositoryStat.isDirectory()) {
      return {
        error: 'Repository path is not a directory.',
        isValid: false,
      };
    }
  } catch (_error: unknown) {
    return {
      error: 'Repository path does not exist.',
      isValid: false,
    };
  }

  try {
    const insideWorkTree = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: repository.path,
      encoding: 'utf8',
    });

    if (insideWorkTree.stdout.trim() !== 'true') {
      return {
        error: 'Repository path is not a Git repository.',
        isValid: false,
      };
    }

    const topLevel = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: repository.path,
      encoding: 'utf8',
    });

    // Compare canonical paths so symlinked repository roots match Git's
    // canonical top-level path instead of being rejected by string spelling.
    const [inputPath, repositoryRootPath] = await Promise.all([
      realpath(repository.path),
      realpath(topLevel.stdout.trim()),
    ]);

    if (inputPath !== repositoryRootPath) {
      return {
        error: 'Repository path must be the Git repository root.',
        isValid: false,
      };
    }

    return { isValid: true };
  } catch (_error: unknown) {
    return {
      error: 'Repository path is not a Git repository.',
      isValid: false,
    };
  }
}
