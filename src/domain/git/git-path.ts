// Git quotes paths even with core.quotePath=false when they contain control characters,
// quotes, or backslashes. Octal escapes represent UTF-8 bytes, not Unicode code points.
export function decodeGitPath(path: string): string {
  if (!path.startsWith('"')) return path;
  const escapes: Record<string, string> = {
    a: '\x07',
    b: '\b',
    t: '\t',
    n: '\n',
    v: '\v',
    f: '\f',
    r: '\r',
    '"': '"',
    '\\': '\\',
  };
  return path
    .slice(1, -1)
    .replace(/(?:\\[0-7]{3})+|\\([abtnvfr"\\])/g, (match, escape: string | undefined) => {
      if (escape !== undefined) return escapes[escape];
      const bytes = match.match(/[0-7]{3}/g)!.map((octal: string) => parseInt(octal, 8));
      return new TextDecoder().decode(new Uint8Array(bytes));
    });
}

export function encodeGitPath(path: string): string {
  const escaped = Array.from(path, (char) => {
    if (char === '"' || char === '\\') return '\\' + char;
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return '\\' + code.toString(8).padStart(3, '0');
    return char;
  }).join('');
  // Git leaves whitespace unquoted and relies on heuristics to split `diff --git` headers.
  // Quoting it too keeps every header unambiguous, including leading or trailing spaces.
  return escaped !== path || /\s/.test(path) ? '"' + escaped + '"' : path;
}

export function parseGitDiffPaths(header: string): [string, string] {
  const paths = header.slice('diff --git '.length);
  // Spaces are not quoted by Git. Prefer the split whose paths agree, which also
  // covers binary and mode-only changes that have no --- / +++ headers.
  const candidates = / (?:b\/|"b\/)/g;
  for (const match of paths.matchAll(candidates)) {
    const oldPath = decodeGitPath(paths.slice(0, match.index)).slice(2);
    const newPath = decodeGitPath(paths.slice(match.index + 1)).slice(2);
    if (oldPath === newPath) return [oldPath, newPath];
  }
  // Rename/copy metadata and text headers provide authoritative paths when the
  // unquoted diff header is ambiguous.
  const match = paths.match(/^("(?:\\.|[^"\\])*"|a\/.*?) ("(?:\\.|[^"\\])*"|b\/.*)$/);
  return match ? [decodeGitPath(match[1]).slice(2), decodeGitPath(match[2]).slice(2)] : ['', ''];
}
