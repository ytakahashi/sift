import type { DirectoryListing } from '../../domain/filesystem/directory-listing';

export class DirectoryBrowseError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404,
  ) {
    super(message);
    this.name = 'DirectoryBrowseError';
  }
}

export interface DirectoryBrowser {
  listDirectories(
    path: string | undefined,
    options: { showHidden: boolean },
  ): Promise<DirectoryListing>;
}
