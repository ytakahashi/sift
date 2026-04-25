import type { RepositoryDescriptor } from '../../domain/repository/repository';
import { createRepoWatcher, type RepoWatcher } from './repo-watcher';
import { createWatchHub, type WatchHub, type WatchStream } from './watch-hub';

interface RepoWatchEntry {
  hub: WatchHub;
  subscribers: number;
  watcher: RepoWatcher;
}

export interface RepoWatchManager {
  close: () => Promise<void>;
  subscribe: (repository: RepositoryDescriptor, stream: WatchStream) => Promise<void>;
}

export interface CreateRepoWatchManagerOptions {
  createHub?: () => WatchHub;
  createWatcher?: (repoRoot: string, onChanged: () => void) => RepoWatcher;
}

// The multi-repository UI opens one repository at a time, but users can switch
// repositories without restarting the server. Start watching a repository only
// after a scoped SSE subscription arrives, share that watcher across duplicate
// tabs for the same repoId, and stop it once the last tab leaves so inactive
// repositories do not keep filesystem watchers open.
export function createRepoWatchManager(
  options: CreateRepoWatchManagerOptions = {},
): RepoWatchManager {
  const createHub = options.createHub ?? createWatchHub;
  const createWatcher = options.createWatcher ?? createRepoWatcher;
  const entries = new Map<string, RepoWatchEntry>();

  const getOrCreateEntry = (repository: RepositoryDescriptor): RepoWatchEntry => {
    const existingEntry = entries.get(repository.id);
    if (existingEntry) {
      return existingEntry;
    }

    const hub = createHub();
    const watcher = createWatcher(repository.path, () => {
      hub.broadcastChanged();
    });
    const entry: RepoWatchEntry = {
      hub,
      subscribers: 0,
      watcher,
    };
    entries.set(repository.id, entry);
    return entry;
  };

  const stopEntryIfUnused = async (repositoryId: string, entry: RepoWatchEntry): Promise<void> => {
    if (entry.subscribers > 0) {
      return;
    }

    entries.delete(repositoryId);
    entry.hub.close();
    await entry.watcher.stop();
  };

  return {
    close: async () => {
      const activeEntries = Array.from(entries.values());
      entries.clear();
      await Promise.all(
        activeEntries.map(async (entry) => {
          entry.hub.close();
          await entry.watcher.stop();
        }),
      );
    },
    subscribe: async (repository: RepositoryDescriptor, stream: WatchStream) => {
      if (stream.aborted || stream.closed) {
        return;
      }

      const entry = getOrCreateEntry(repository);
      let unsubscribed = false;
      entry.subscribers += 1;
      entry.hub.subscribe(stream);

      stream.onAbort(async () => {
        if (unsubscribed) {
          return;
        }

        unsubscribed = true;
        // A remaining tab for the same repoId should keep receiving changes,
        // but the aborted stream must be removed immediately instead of waiting
        // for the next broadcast to discover the closed connection.
        entry.hub.unsubscribe(stream);
        entry.subscribers -= 1;
        await stopEntryIfUnused(repository.id, entry);
      });
    },
  };
}
