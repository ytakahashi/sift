import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { REPOSITORY_ID_PATTERN } from '../../domain/repository/repository';
import type { ServerRepository } from './server-repository';

const execFileAsync = promisify(execFile);

export interface RepositoryValidationResult {
  error?: string;
  isValid: boolean;
}

export type RepositoryValidator = (
  repository: ServerRepository,
) => Promise<RepositoryValidationResult>;

export async function validateRepositoryPath(
  repository: ServerRepository,
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
  } catch {
    return {
      error: 'Repository path does not exist.',
      isValid: false,
    };
  }

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: repository.path,
      encoding: 'utf8',
    });

    if (stdout.trim() === 'true') {
      return { isValid: true };
    }
  } catch {
    return {
      error: 'Repository path is not a Git repository.',
      isValid: false,
    };
  }

  return {
    error: 'Repository path is not a Git repository.',
    isValid: false,
  };
}
