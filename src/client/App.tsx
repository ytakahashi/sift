import type { ReactElement } from 'react';
import { useAppRoute } from './hooks/routing/useAppRoute';
import { RepositorySelectionPage } from './pages/RepositorySelectionPage';
import { RepositoryViewerPage } from './pages/RepositoryViewerPage';
import type { AppDependencies } from './composition/dependencies';

interface AppProps {
  dependencies: AppDependencies;
}

function App({ dependencies }: AppProps): ReactElement {
  const { navigate, navigateToSelection, route } = useAppRoute();

  if (route.type === 'selection') {
    return <RepositorySelectionPage dependencies={dependencies} onSelectRepository={navigate} />;
  }

  return (
    <RepositoryViewerPage
      dependencies={dependencies}
      repoId={route.repoId}
      onNavigateToRoot={navigateToSelection}
      onSelectRepository={navigate}
    />
  );
}

export default App;
