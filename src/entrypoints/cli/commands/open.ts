import { Command } from 'commander';
import type { ResolvedRepository } from '../../../domain/repository/repository';
import { buildRepositoryPath } from '../../../domain/repository/repository-route';
import type { StartServerResult } from '../../../server/index';

export interface OpenCommandDependencies {
  listRegisteredRepositories: () => Promise<ResolvedRepository[]>;
  openApp: (repoId?: string) => Promise<void>;
  openBrowser: (url: string) => void;
  resolveRepositoryIdForOpen: (targetPath?: string) => Promise<string | null>;
  selectRepository: (repositories: ResolvedRepository[]) => Promise<ResolvedRepository | null>;
  startServer: () => Promise<StartServerResult>;
}

interface OpenCommandOptions {
  app?: boolean;
  browser?: boolean;
  interactive?: boolean;
}

export function createOpenCommand(dependencies: OpenCommandDependencies): Command {
  return new Command('open')
    .description('Open a repository in the browser or the Sift macOS app')
    .argument('[path]', 'Repository path to open (defaults to the current directory)')
    .option('-a, --app', 'Open the Sift macOS application')
    .option('-b, --browser', 'Open the browser (default)')
    .option('-i, --interactive', 'Pick a registered repository to open interactively')
    .action(async (targetPath: string | undefined, options: OpenCommandOptions) => {
      // Validate conflicting options before any side effects.
      if (options.app && options.browser) {
        throw new Error('Cannot specify both --app and --browser.');
      }
      if (options.interactive && targetPath !== undefined) {
        throw new Error('Cannot specify both a path and --interactive.');
      }

      let repoId: string | null;
      if (options.interactive) {
        const repositories = await dependencies.listRegisteredRepositories();
        if (repositories.length === 0) {
          console.log('No repositories are registered.');
          return;
        }

        const selected = await dependencies.selectRepository(repositories);
        if (!selected) {
          return;
        }

        repoId = selected.id;
      } else {
        repoId = await dependencies.resolveRepositoryIdForOpen(targetPath);
      }

      if (options.app) {
        await dependencies.openApp(repoId ?? undefined);
        console.log('Sift application opened.');
        return;
      }

      const { owned, url } = await dependencies.startServer();
      if (owned) {
        console.log(`Server started at ${url}`);
      }

      const targetUrl = repoId ? `${url}${buildRepositoryPath(repoId)}` : url;
      dependencies.openBrowser(targetUrl);
    });
}
