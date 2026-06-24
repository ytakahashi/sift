import { Command } from 'commander';
import { buildRepositoryPath } from '../../domain/repository/repository-route';
import { APP_INFO } from '../../server/app-info';
import type { RepositoryConfigUpdater } from '../../server/index';

export interface CliDependencies {
  createRepositoryConfigUpdater: () => Pick<RepositoryConfigUpdater, 'addRepository'>;
  openApp: (repoId?: string) => Promise<void>;
  openBrowser: (url: string) => void;
  resolveInitialRepositoryIdForLaunch: () => Promise<string | null>;
  resolveRepoRoot: (targetPath: string) => string;
  startServer: () => Promise<string>;
}

interface CliOptions {
  add?: string | boolean;
  app?: boolean;
  browser?: boolean;
  server?: boolean;
}

export function createCliProgram(dependencies: CliDependencies): Command {
  const program = new Command()
    .name(APP_INFO.name)
    .description(APP_INFO.description)
    .version(APP_INFO.version)
    .argument('[path]', 'Repository path used with --add (defaults to current directory)')
    .option('--add [path]', 'Add a repository to the local Sift config before starting')
    .option('-s, --server', 'Start the local Sift server')
    .option('-b, --browser', 'Open the browser automatically')
    .option('-a, --app', 'Open the Sift macOS application')
    .action(async (targetPath: string | undefined, options: CliOptions) => {
      // Commander returns `true` for `sift --add` and a string for
      // `sift --add /path`; bare `--add` should reuse the positional path so
      // `sift --add .` and `sift --add` from a repo behave the same.
      const addTargetPath =
        typeof options.add === 'string' ? options.add : options.add ? (targetPath ?? '.') : null;

      // Validate conflicting options before any side effects.
      if (options.app && options.browser) {
        throw new Error('Cannot specify both --app and --browser.');
      }
      if (options.app && options.server) {
        throw new Error('Cannot specify both --app and --server.');
      }

      let addedRepositoryId: string | null = null;
      if (addTargetPath) {
        console.log(`Resolving repository at: ${addTargetPath}`);
        const repoRoot = dependencies.resolveRepoRoot(addTargetPath);
        console.log(`Repository root identified: ${repoRoot}`);
        const updater = dependencies.createRepositoryConfigUpdater();
        const addedRepository = await updater.addRepository(repoRoot);
        console.log(`Repository registered as "${addedRepository.id}".`);
        addedRepositoryId = addedRepository.id;
      }

      const shouldStartServer = options.server || options.browser;
      if (!shouldStartServer && !options.app) {
        if (!addTargetPath) {
          program.outputHelp();
        }
        return;
      }

      // Prefer the just-added repository so `--add` + `--browser`/`--app` opens
      // exactly what the user pointed at, avoiding cwd-vs-add-path ambiguity.
      let initialRepoId: string | null = null;
      if (options.browser || options.app) {
        initialRepoId =
          addedRepositoryId ?? (await dependencies.resolveInitialRepositoryIdForLaunch());
      }

      // Open the standalone desktop app if requested.
      if (options.app) {
        await dependencies.openApp(initialRepoId ?? undefined);
        console.log('Sift application opened.');
        return;
      }

      // Start the local development/production server.
      const url = await dependencies.startServer();
      console.log(`Server started at ${url}`);

      const targetUrl = initialRepoId ? `${url}${buildRepositoryPath(initialRepoId)}` : url;

      if (options.browser) {
        dependencies.openBrowser(targetUrl);
      } else {
        console.log(`Open ${targetUrl} in your browser to view the diff.`);
      }
    });

  return program;
}
