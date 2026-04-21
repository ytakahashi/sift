export const DEFAULT_REPO_ID = 'default';

export type RepositoryId = string;

export interface RepositoryListItem {
  error?: string;
  id: RepositoryId;
  isValid: boolean;
  name: string;
  path: string;
}

export interface RepositoryList {
  config:
    | {
        status: 'found';
      }
    | {
        path: string;
        status: 'missing';
      }
    | {
        error: string;
        status: 'invalid';
      };
  repositories: RepositoryListItem[];
}
