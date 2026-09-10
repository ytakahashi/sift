import type { RepositoryId } from '../../../domain/repository/repository';
import {
  BlobContentFetchError,
  type BlobContent,
  type BlobContentReader,
} from '../../application/ports';
import { readErrorMessage } from './errorResponse';

export const httpBlobContentReader: BlobContentReader = {
  async fetchBlobContent(repoId: RepositoryId, blobId: string): Promise<BlobContent> {
    const query = new URLSearchParams({ blobId });
    const response = await fetch(
      `/api/repositories/${encodeURIComponent(repoId)}/blob-content?${query.toString()}`,
    );
    if (!response.ok) {
      throw new BlobContentFetchError(
        await readErrorMessage(response, `Failed to fetch blob content: ${response.statusText}`),
        response.status,
      );
    }

    return (await response.json()) as BlobContent;
  },
};
