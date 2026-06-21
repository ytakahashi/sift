const WINDOWS_PATH_SEPARATOR = '\\';
const POSIX_PATH_SEPARATOR = '/';

function resolvePathSeparator(repositoryRoot: string): '/' | '\\' {
  return repositoryRoot.includes(WINDOWS_PATH_SEPARATOR)
    ? WINDOWS_PATH_SEPARATOR
    : POSIX_PATH_SEPARATOR;
}

export function resolveAbsoluteFilePath(repositoryRoot: string, filePath: string): string {
  const separator = resolvePathSeparator(repositoryRoot);
  const normalizedRoot = repositoryRoot.replace(/[\\/]+$/g, '');
  const normalizedFilePath = filePath.replace(/^[\\/]+/g, '').replace(/[\\/]+/g, separator);

  if (!normalizedRoot) {
    return `${separator}${normalizedFilePath}`;
  }

  return `${normalizedRoot}${separator}${normalizedFilePath}`;
}

export function abbreviateFilePath(filePath: string): string {
  const lastSeparatorIndex = Math.max(
    filePath.lastIndexOf(POSIX_PATH_SEPARATOR),
    filePath.lastIndexOf(WINDOWS_PATH_SEPARATOR),
  );

  if (lastSeparatorIndex < 0 || lastSeparatorIndex === filePath.length - 1) {
    return filePath;
  }

  return `.../${filePath.slice(lastSeparatorIndex + 1)}`;
}
