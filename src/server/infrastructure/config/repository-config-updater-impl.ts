import path from 'node:path';
import type { RepositoryId } from '../../../domain/repository/repository';
import {
  deriveRepositoryId,
  deriveRepositoryName,
} from '../../../domain/repository/repository-identity';
import type { RepositoryConfig } from './repository-config-schema';
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

async function readConfigForUpdate(configPath: string): Promise<RepositoryConfig> {
  try {
    return await readExistingRepositoryConfig(configPath);
  } catch (error: unknown) {
    if (error instanceof RepositoryConfigParseError) {
      throw new RepositoryConfigUpdateError(error.message, 400);
    }

    throw error;
  }
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

      const existingConfig = await readConfigForUpdate(configPath);

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
    removeRepository: async (repoId: RepositoryId): Promise<void> => {
      const existingConfig = await readConfigForUpdate(configPath);

      const matches = existingConfig.repositories
        .map((entry, index) => ({
          id: deriveRepositoryId(normalizeConfiguredRepositoryPath(entry.path)),
          index,
        }))
        .filter((entry) => entry.id === repoId);

      if (matches.length === 0) {
        throw new RepositoryConfigUpdateError(`Repository id "${repoId}" is not configured.`, 404);
      }

      if (matches.length > 1) {
        throw new RepositoryConfigUpdateError(`Repository id "${repoId}" is duplicated.`, 409);
      }

      const removeIndex = matches[0].index;
      const newConfig = {
        repositories: existingConfig.repositories.filter((_, index) => index !== removeIndex),
      };

      await writeRepositoryConfig(newConfig, configPath);
      invalidateConfig();
    },
  };
}
