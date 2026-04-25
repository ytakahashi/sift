export type RepositoryId = string;

export const REPOSITORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export interface RepositoryDescriptor {
  id: RepositoryId;
  path: string;
}
