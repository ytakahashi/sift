export type FileContentResult =
  | { kind: 'file'; blobId: string; lines: string[] }
  | { kind: 'not-found' }
  | { kind: 'too-large' }
  | { kind: 'unsupported' };

export interface FileContentProvider {
  getContent(path: string): Promise<FileContentResult>;
}
