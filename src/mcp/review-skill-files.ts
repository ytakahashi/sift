import { readFile, readdir } from 'node:fs/promises';

export async function readReviewSkillFiles(): Promise<Record<string, string>> {
  const root = new URL('./skills/', import.meta.url);
  const files: Record<string, string> = {};

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const directory = new URL(`${encodeURIComponent(entry.name)}/`, root);
    const contents = await readdir(directory, { withFileTypes: true });
    if (contents.some((file) => file.isFile() && file.name === 'SKILL.md')) {
      files[`${entry.name}/SKILL.md`] = await readFile(new URL('SKILL.md', directory), 'utf8');
    }
  }

  return files;
}
