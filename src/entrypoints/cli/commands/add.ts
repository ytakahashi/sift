import { Command } from 'commander';
import type { RepositoryConfigUpdater } from '../../../server/index';

export interface AddCommandDependencies {
  createRepositoryConfigUpdater: () => Pick<RepositoryConfigUpdater, 'addRepository'>;
  resolveRepoRoot: (targetPath: string) => string;
}

export function createAddCommand(dependencies: AddCommandDependencies): Command {
  return new Command('add')
    .description('Register a repository in the local Sift config')
    .argument('[path]', 'Repository path to add (defaults to the current directory)')
    .action(async (targetPath: string | undefined) => {
      const addTargetPath = targetPath ?? '.';

      console.log(`Resolving repository at: ${addTargetPath}`);
      const repoRoot = dependencies.resolveRepoRoot(addTargetPath);
      console.log(`Repository root identified: ${repoRoot}`);

      const updater = dependencies.createRepositoryConfigUpdater();
      const addedRepository = await updater.addRepository(repoRoot);
      console.log(`Repository registered as "${addedRepository.id}".`);
    });
}
