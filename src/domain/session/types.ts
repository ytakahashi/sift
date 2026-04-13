import type { AppMode } from '../diff/types';

export type RepositoryInfo = {
  name: string;
  root: string;
};

export type SessionCapabilities = {
  splitView: boolean;
  stdinMode: boolean;
};

export type SessionInfo = {
  mode: AppMode;
  repository: RepositoryInfo;
  capabilities: SessionCapabilities;
  availableViewModes: string[];
};
