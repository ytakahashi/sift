import type { ReactElement, ReactNode } from 'react';

export interface AppHeaderRepositoryLabel {
  name: string;
  path: string;
}

export interface AppHeaderProps {
  onNavigateHome?: () => void;
  repositoryLabel?: AppHeaderRepositoryLabel;
  errorMessage?: string | null;
  actions: ReactNode;
}

export function AppHeader({
  onNavigateHome,
  repositoryLabel,
  errorMessage,
  actions,
}: AppHeaderProps): ReactElement {
  return (
    <header className="app-header">
      <div className="app-brand">
        <AppBrandHome onNavigateHome={onNavigateHome} />
        {repositoryLabel && (
          <span className="app-repository-name" title={repositoryLabel.path}>
            {repositoryLabel.name}
          </span>
        )}
      </div>
      <div className="app-header-actions">
        {errorMessage && <span className="app-header-error">{errorMessage}</span>}
        {actions}
      </div>
    </header>
  );
}

function AppBrandHome({ onNavigateHome }: { onNavigateHome?: () => void }): ReactElement {
  const brandContent = (
    <>
      <img className="app-brand-logo" src="/favicon.svg" alt="" />
      <span className="app-brand-title">Sift</span>
    </>
  );

  if (onNavigateHome) {
    return (
      <button className="app-brand-home" onClick={onNavigateHome} type="button">
        {brandContent}
      </button>
    );
  }

  return <div className="app-brand-home">{brandContent}</div>;
}
