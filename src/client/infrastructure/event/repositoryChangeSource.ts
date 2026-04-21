import type { RepositoryId } from '../../../domain/repository/repository';
import type { RepositoryChangeSource, RepositoryChangeSubscription } from '../../application/ports';

export const sseRepositoryChangeSource: RepositoryChangeSource = {
  subscribe(repoId: RepositoryId, onChange: () => void): RepositoryChangeSubscription {
    if (typeof EventSource === 'undefined') {
      return { unsubscribe: () => {} };
    }

    const source = new EventSource(`/api/repositories/${encodeURIComponent(repoId)}/watch`);
    source.addEventListener('changed', onChange);

    return {
      unsubscribe: () => {
        source.close();
      },
    };
  },
};
