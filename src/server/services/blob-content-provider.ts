export type BlobContentResult =
  | { kind: 'file'; lines: string[] }
  | { kind: 'not-found' }
  | { kind: 'too-large' }
  | { kind: 'unsupported' };

export interface BlobContentProvider {
  getContent(blobId: string): Promise<BlobContentResult>;
}
