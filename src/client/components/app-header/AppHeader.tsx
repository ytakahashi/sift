import type { ReactElement, ReactNode } from 'react';
import { GitBranch, GitCommitHorizontal } from 'lucide-react';
import type { HeadLabel } from '../../presentation/app-header/head-label';

export interface AppHeaderRepositoryLabel {
  name: string;
  path: string;
}

export interface AppHeaderProps {
  onNavigateHome?: () => void;
  repositoryLabel?: AppHeaderRepositoryLabel;
  branchLabel?: HeadLabel;
  errorMessage?: string | null;
  actions: ReactNode;
}

export function AppHeader({
  onNavigateHome,
  repositoryLabel,
  branchLabel,
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
        {branchLabel && <AppBranchLabel label={branchLabel} />}
      </div>
      <div className="app-header-actions">
        {errorMessage && <span className="app-header-error">{errorMessage}</span>}
        {actions}
      </div>
    </header>
  );
}

function AppBranchLabel({ label }: { label: HeadLabel }): ReactElement {
  // A detached HEAD points at a commit, not a branch, so the branch icon would
  // misdescribe it.
  const Icon = label.detached ? GitCommitHorizontal : GitBranch;

  return (
    <span
      className="app-branch-name"
      data-detached={label.detached || undefined}
      title={label.title}
    >
      <Icon aria-hidden="true" className="app-branch-name-icon" size={14} strokeWidth={1.8} />
      <span className="app-branch-name-text">{label.text}</span>
    </span>
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
