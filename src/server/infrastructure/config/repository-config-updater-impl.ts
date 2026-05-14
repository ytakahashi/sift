import path from 'node:path';
import type { RepositoryId } from '../../../domain/repository/repository';
import {
  deriveRepositoryId,
  deriveRepositoryName,
} from '../../../domain/repository/repository-identity';
import type { RepositoryConfig, RepositoryConfigEntry } from './repository-config-schema';
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

      // Walk entries once and collect indices that derive to the requested id.
      // Stop early after the second match because two are enough to flag a
      // duplicated id; we don't need to scan the rest of the list.
      const matchingIndices: number[] = [];
      for (let index = 0; index < existingConfig.repositories.length; index += 1) {
        const entry = existingConfig.repositories[index];
        const id = deriveRepositoryId(normalizeConfiguredRepositoryPath(entry.path));
        if (id === repoId) {
          matchingIndices.push(index);
          if (matchingIndices.length > 1) break;
        }
      }

      if (matchingIndices.length === 0) {
        return;
      }

      if (matchingIndices.length > 1) {
        throw new RepositoryConfigUpdateError(`Repository id "${repoId}" is duplicated.`, 409);
      }

      const removeIndex = matchingIndices[0];
      const newConfig = {
        repositories: existingConfig.repositories.filter((_, index) => index !== removeIndex),
      };

      await writeRepositoryConfig(newConfig, configPath);
      invalidateConfig();
    },
    reorderRepositories: async (orderedIds: RepositoryId[]): Promise<void> => {
      const existingConfig = await readConfigForUpdate(configPath);

      // Build runtime descriptors from every configured entry before
      // validation. Reorder operates on derived repository IDs, while the
      // config still stores path-only entries.
      const descriptors = existingConfig.repositories.map((entry) => {
        const normalizedPath = normalizeConfiguredRepositoryPath(entry.path);
        return {
          entry,
          id: deriveRepositoryId(normalizedPath),
          path: normalizedPath,
        };
      });

      // Detect duplicates across all entries, resolved or invalid. This mirrors
      // list resolution: duplicate derived IDs make the config ambiguous before
      // any reorder request can be applied.
      const configuredIds = new Set<RepositoryId>();
      for (const { id } of descriptors) {
        if (configuredIds.has(id)) {
          throw new RepositoryConfigUpdateError(`Repository id "${id}" is duplicated.`, 409);
        }
        configuredIds.add(id);
      }

      const resolvedEntries: Array<{ id: RepositoryId; entry: RepositoryConfigEntry }> = [];
      const invalidEntries: RepositoryConfigEntry[] = [];
      // Only valid repositories participate in reorder. Invalid entries cannot
      // be placed precisely by the client because the API returns them in a
      // separate list, so they are preserved after the reordered valid entries.
      for (const descriptor of descriptors) {
        const validation = await validateRepository({ id: descriptor.id, path: descriptor.path });
        if (validation.isValid) {
          resolvedEntries.push({ id: descriptor.id, entry: descriptor.entry });
        } else {
          invalidEntries.push(descriptor.entry);
        }
      }

      // Request-side duplicates are a client error even if the config itself is
      // valid; otherwise a single repository could be written more than once.
      const requestedIds = new Set<RepositoryId>();
      for (const id of orderedIds) {
        if (requestedIds.has(id)) {
          throw new RepositoryConfigUpdateError('Reorder request contains duplicate IDs.', 400);
        }
        requestedIds.add(id);
      }

      const resolvedMap = new Map(resolvedEntries.map(({ id, entry }) => [id, entry]));
      // The request must provide a complete permutation of resolved entries.
      // Partial orders are rejected so the persisted config has a deterministic
      // full order after every successful call.
      if (orderedIds.length !== resolvedMap.size) {
        throw new RepositoryConfigUpdateError(
          'Reorder request must include all resolved repository IDs.',
          400,
        );
      }

      const reorderedResolvedEntries = orderedIds.map((id) => {
        const entry = resolvedMap.get(id);
        if (!entry) {
          throw new RepositoryConfigUpdateError(`Repository id "${id}" is not configured.`, 400);
        }
        return entry;
      });

      await writeRepositoryConfig(
        { repositories: [...reorderedResolvedEntries, ...invalidEntries] },
        configPath,
      );
      invalidateConfig();
    },
  };
}
