import type { ReactElement } from 'react';
import { useRepositoryTabNavigation } from './hooks/useRepositoryTabNavigation';
import { RepositorySelectionPage } from './pages/RepositorySelectionPage';
import { RepositoryViewerPage } from './pages/RepositoryViewerPage';
import type { AppDependencies } from './composition/dependencies';

interface AppProps {
  dependencies: AppDependencies;
}

function App({ dependencies }: AppProps): ReactElement {
  const { route, tabs, navigateToSelection, selectTab, closeTab, setTabName } =
    useRepositoryTabNavigation();

  if (route.type === 'selection') {
    return <RepositorySelectionPage dependencies={dependencies} onSelectRepository={selectTab} />;
  }

  return (
    <RepositoryViewerPage
      dependencies={dependencies}
      repoId={route.repoId}
      onNavigateToRoot={navigateToSelection}
      onSelectRepository={selectTab}
      tabs={tabs}
      onSelectTab={selectTab}
      onCloseTab={closeTab}
      onRepositoryResolved={setTabName}
    />
  );
}

export default App;
