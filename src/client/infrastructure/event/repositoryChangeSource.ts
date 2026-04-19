import type { RepositoryChangeSource, RepositoryChangeSubscription } from '../../application/ports';

export const sseRepositoryChangeSource: RepositoryChangeSource = {
  subscribe(onChange: () => void): RepositoryChangeSubscription {
    if (typeof EventSource === 'undefined') {
      return { unsubscribe: () => {} };
    }

    const source = new EventSource('/api/watch');
    source.addEventListener('changed', onChange);

    return {
      unsubscribe: () => {
        source.close();
      },
    };
  },
};
