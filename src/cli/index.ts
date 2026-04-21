import { Command } from 'commander';
import { resolveRepoRoot } from './resolve-repo';
import { openBrowser } from './open-browser';
import { addRepositoryConfigEntry } from './repository-config';
import { startServer } from '../server/index';

const program = new Command();

program
  .name('sift')
  .description('Sift before you commit. A lightweight local diff viewer.')
  .version('1.0.0')
  .argument('[path]', 'Target directory path (defaults to current directory)', process.cwd())
  .option('--add [path]', 'Add a repository to the local Sift config before starting')
  .option('-o, --open', 'Open the browser automatically')
  .action(async (targetPath, options) => {
    try {
      // Commander returns `true` for `sift --add` and a string for
      // `sift --add /path`; bare `--add` should reuse the positional path so
      // `sift --add .` and `sift --add` from a repo behave the same.
      const addTargetPath =
        typeof options.add === 'string' ? options.add : options.add ? targetPath : null;
      const repositoryTargetPath = addTargetPath ?? targetPath;

      console.log(`Resolving repository at: ${repositoryTargetPath}`);
      const repoRoot = resolveRepoRoot(repositoryTargetPath);
      console.log(`Repository root identified: ${repoRoot}`);

      if (addTargetPath) {
        const addedRepository = await addRepositoryConfigEntry(repoRoot);
        console.log(`Repository registered as "${addedRepository.id}".`);
      }

      // Start the local development/production server
      const url = await startServer(repoRoot);
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
