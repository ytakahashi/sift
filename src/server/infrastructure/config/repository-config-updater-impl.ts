import path from 'node:path';
import {
  deriveRepositoryId,
  deriveRepositoryName,
} from '../../../domain/repository/repository-identity';
import { RepositoryConfigParseError } from './repository-config-schema';
import {
  DEFAULT_REPOSITORY_CONFIG_PATH,
  normalizeConfiguredRepositoryPath,
  readExistingRepositoryConfig,
  writeRepositoryConfig,
} from './repository-config-store';
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

      const normalizedPath = normalizeConfiguredRepositoryPath(trimmedPath);

      const existingConfig = await (async () => {
        try {
          return await readExistingRepositoryConfig(configPath);
        } catch (error: unknown) {
          if (error instanceof RepositoryConfigParseError) {
            throw new RepositoryConfigUpdateError(error.message, 400);
          }

          throw error;
        }
      })();

      // Check for duplicate paths after normalization
      const alreadyRegistered = existingConfig.repositories.some((entry) => {
        return normalizeConfiguredRepositoryPath(entry.path) === normalizedPath;
      });

      if (alreadyRegistered) {
        throw new RepositoryConfigUpdateError(
          `Repository is already registered: ${normalizedPath}`,
          409,
        );
      }

      // Derive runtime descriptor for validation
      const descriptor = {
        id: deriveRepositoryId(normalizedPath),
        path: normalizedPath,
      };

      const validation = await validateRepository(descriptor);
      if (!validation.isValid) {
        throw new RepositoryConfigUpdateError(
          validation.error ?? 'Repository path is invalid.',
          400,
        );
      }

      // Write path-only config entry
      const newConfig = {
        repositories: [...existingConfig.repositories, { path: normalizedPath }],
      };

      await writeRepositoryConfig(newConfig, configPath);
      invalidateConfig();

      return {
        id: descriptor.id,
        name: deriveRepositoryName(normalizedPath),
        path: normalizedPath,
      };
    },
  };
}
