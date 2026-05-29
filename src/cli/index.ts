import { Command } from 'commander';
import { resolveRepoRoot } from './resolve-repo';
import { openBrowser } from './open-browser';
import { openApp } from './open-app';
import { APP_INFO } from '../server/app-info';
import { createRepositoryConfigUpdater, startServer } from '../server/index';

const program = new Command();

program
  .name(APP_INFO.name)
  .description(APP_INFO.description)
  .version(APP_INFO.version)
  .argument('[path]', 'Repository path used with --add (defaults to current directory)')
  .option('--add [path]', 'Add a repository to the local Sift config before starting')
  .option('-o, --open', 'Open the browser automatically')
  .option('--app', 'Open the Sift macOS application')
  .action(async (targetPath, options) => {
    try {
      // Commander returns `true` for `sift --add` and a string for
      // `sift --add /path`; bare `--add` should reuse the positional path so
      // `sift --add .` and `sift --add` from a repo behave the same.
      const addTargetPath =
        typeof options.add === 'string' ? options.add : options.add ? (targetPath ?? '.') : null;

      if (addTargetPath) {
        console.log(`Resolving repository at: ${addTargetPath}`);
        const repoRoot = resolveRepoRoot(addTargetPath);
        console.log(`Repository root identified: ${repoRoot}`);
        const updater = createRepositoryConfigUpdater();
        const addedRepository = await updater.addRepository(repoRoot);
        console.log(`Repository registered as "${addedRepository.id}".`);
      }

      // Check for conflicting options
      if (options.app && options.open) {
        throw new Error('Cannot specify both --app and --open.');
      }

      // Open the standalone desktop app if requested
      if (options.app) {
        await openApp();
        console.log('Sift application opened.');
        return;
      }

      // Start the local development/production server
      const url = await startServer();
      console.log(`Server started at ${url}`);

      // Open browser optionally
      if (options.open) {
        openBrowser(url);
      } else {
        console.log(`Open ${url} in your browser to view the diff.`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
