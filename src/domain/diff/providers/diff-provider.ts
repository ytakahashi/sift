import type { DiffFile, FileBucket } from '../types';

export interface DiffSource {
  bucket: FileBucket;
  contextId: string;
}

export interface DiffProvider {
  /**
   * Returns a list of all files with differences in the requested bucket.
   */
  getFiles(bucket: FileBucket): Promise<DiffFile[]>;
  /**
   * Validates if the provider is available and ready.
   */
  validate(): Promise<boolean>;
}
