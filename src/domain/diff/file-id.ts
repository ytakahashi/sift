/** Builds the stable diff-file identity used by note anchors and parsed diffs. */
export function createDiffFileId(path: string): string {
  return `file-${path}`;
}
