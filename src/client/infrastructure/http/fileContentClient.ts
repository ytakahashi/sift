import type { RepositoryId } from '../../../domain/repository/repository';
import {
  FileContentFetchError,
  type FileContent,
  type FileContentReader,
} from '../../application/ports';
import { readErrorMessage } from './errorResponse';

export const httpFileContentReader: FileContentReader = {
  async fetchFileContent(repoId: RepositoryId, path: string): Promise<FileContent> {
    const query = new URLSearchParams({ path });
    const response = await fetch(
      `/api/repositories/${encodeURIComponent(repoId)}/file-content?${query.toString()}`,
    );
    if (!response.ok) {
      throw new FileContentFetchError(
        await readErrorMessage(response, `Failed to fetch file content: ${response.statusText}`),
        response.status,
      );
    }

    return (await response.json()) as FileContent;
  },
};
