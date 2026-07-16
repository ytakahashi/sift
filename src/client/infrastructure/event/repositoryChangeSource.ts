import type { RepositoryId } from '../../../domain/repository/repository';
import type {
  RepositoryChangeHandlers,
  RepositoryChangeSource,
  RepositoryChangeSubscription,
} from '../../application/ports';

export const sseRepositoryChangeSource: RepositoryChangeSource = {
  subscribe(
    repoId: RepositoryId,
    handlers: RepositoryChangeHandlers,
  ): RepositoryChangeSubscription {
    if (typeof EventSource === 'undefined') {
      return { unsubscribe: () => {} };
    }

    // Both event kinds share one SSE connection per repository; adding a
    // second EventSource here would double the server-side subscriptions.
    const source = new EventSource(`/api/repositories/${encodeURIComponent(repoId)}/watch`);
    source.addEventListener('changed', handlers.onDiffChange);
    source.addEventListener('notes-changed', handlers.onNotesChange);

    return {
      unsubscribe: () => {
        source.close();
      },
    };
  },
};
