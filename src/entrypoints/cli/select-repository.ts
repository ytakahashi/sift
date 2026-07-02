import { autocomplete, cancel, isCancel } from '@clack/prompts';
import type { ResolvedRepository } from '../../domain/repository/repository';

/**
 * Picks a registered repository interactively for `sift open -i`.
 *
 * Uses @clack/prompts' `autocomplete` (incremental filtering + arrow-key
 * selection in one prompt) rather than @inquirer/prompts: same UX, smaller
 * ESM-first dependency tree that fits this project's `"type": "module"`
 * setup. Kept out of `commands/open.ts` so its action stays a pure,
 * mockable function with no direct terminal I/O.
 */
export async function selectRepositoryInteractively(
  repositories: ResolvedRepository[],
): Promise<ResolvedRepository | null> {
  // autocomplete needs a real terminal for raw-mode key handling; running it
  // against piped/non-TTY stdin would hang instead of failing cleanly.
  if (!process.stdin.isTTY) {
    console.log('Interactive selection requires a terminal (stdin is not a TTY).');
    return null;
  }

  const selected = await autocomplete<ResolvedRepository>({
    message: 'Select a repository to open',
    options: repositories.map((repository) => ({
      value: repository,
      label: repository.name,
      hint: repository.path,
    })),
  });

  if (isCancel(selected)) {
    cancel('Selection cancelled.');
    return null;
  }

  return selected;
}
