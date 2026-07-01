import { Command } from 'commander';
import { buildRepositoryPath } from '../../../domain/repository/repository-route';

export interface OpenCommandDependencies {
  openApp: (repoId?: string) => Promise<void>;
  openBrowser: (url: string) => void;
  resolveRepositoryIdForOpen: (targetPath?: string) => Promise<string | null>;
  startServer: () => Promise<string>;
}

interface OpenCommandOptions {
  app?: boolean;
  browser?: boolean;
}

export function createOpenCommand(dependencies: OpenCommandDependencies): Command {
  return new Command('open')
    .description('Open a repository in the browser or the Sift macOS app')
    .argument('[path]', 'Repository path to open (defaults to the current directory)')
    .option('-a, --app', 'Open the Sift macOS application')
    .option('-b, --browser', 'Open the browser (default)')
    .action(async (targetPath: string | undefined, options: OpenCommandOptions) => {
      // Validate conflicting options before any side effects.
      if (options.app && options.browser) {
        throw new Error('Cannot specify both --app and --browser.');
      }

      const repoId = await dependencies.resolveRepositoryIdForOpen(targetPath);

      if (options.app) {
        await dependencies.openApp(repoId ?? undefined);
        console.log('Sift application opened.');
        return;
      }

      const url = await dependencies.startServer();
      console.log(`Server started at ${url}`);

      const targetUrl = repoId ? `${url}${buildRepositoryPath(repoId)}` : url;
      dependencies.openBrowser(targetUrl);
    });
}
