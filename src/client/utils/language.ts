const extensionToLanguage: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  css: 'css',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  py: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  go: 'go',
  rs: 'rust',
  yml: 'yaml',
  yaml: 'yaml',
  diff: 'diff',
  patch: 'diff',
};

export function getLanguageFromPath(filePath: string): string | undefined {
  const parts = filePath.split('.');
  if (parts.length < 2) return undefined;
  const ext = parts.pop()?.toLowerCase();
  if (!ext) return undefined;
  return extensionToLanguage[ext] || ext;
}
