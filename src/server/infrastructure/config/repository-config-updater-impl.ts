import path from 'node:path';
import { RepositoryConfigParseError } from '../../../domain/repository/repository-config';
import {
  addRepositoryToConfig,
  RepositoryAlreadyRegisteredError,
} from '../../../domain/repository/repository-config-update';
import {
  normalizeRepositoryPath,
  readExistingRepositoryConfig,
  writeRepositoryConfig,
} from '../../../local-config/repository-config-store';
import { DEFAULT_REPOSITORY_CONFIG_PATH } from '../../../local-config/repository-config-path';
import type { RepositoryConfigUpdater } from '../../services/repository-config';
import { RepositoryConfigUpdateError } from '../../services/repository-config';
import type { RepositoryValidator } from '../repository-validator';
import { validateRepositoryPath } from '../repository-validator';

export interface CreateRepositoryConfigUpdaterOptions {
  configPath?: string;
  invalidateConfig?: () => void;
  validateRepository?: RepositoryValidator;
}

export function createRepositoryConfigUpdater(
  options: CreateRepositoryConfigUpdaterOptions = {},
): RepositoryConfigUpdater {
  const configPath = options.configPath ?? DEFAULT_REPOSITORY_CONFIG_PATH;
  const validateRepository = options.validateRepository ?? validateRepositoryPath;
  const invalidateConfig = options.invalidateConfig ?? (() => {});

  return {
    addRepository: async (repositoryPath: string) => {
      const trimmedPath = repositoryPath.trim();

      if (!trimmedPath) {
        throw new RepositoryConfigUpdateError('Repository path is required.', 400);
      }

      if (!path.isAbsolute(trimmedPath)) {
        throw new RepositoryConfigUpdateError('Repository path must be an absolute path.', 400);
      }

      const result = await (async () => {
        try {
          const existingConfig = await readExistingRepositoryConfig(configPath);
          return addRepositoryToConfig(existingConfig, normalizeRepositoryPath(trimmedPath));
        } catch (error: unknown) {
          if (error instanceof RepositoryAlreadyRegisteredError) {
            throw new RepositoryConfigUpdateError(error.message, 409);
          }

          if (error instanceof RepositoryConfigParseError) {
            throw new RepositoryConfigUpdateError(error.message, 400);
          }

          throw error;
        }
      })();

      const validation = await validateRepository(result.repository);
      if (!validation.isValid) {
        throw new RepositoryConfigUpdateError(
          validation.error ?? 'Repository path is invalid.',
          400,
        );
      }

      await writeRepositoryConfig(result.config, configPath);
      invalidateConfig();

      return result.repository;
    },
  };
}
