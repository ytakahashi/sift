import { Command } from 'commander';
import { resolveRepoRoot } from './resolve-repo';
import { openBrowser } from './open-browser';
import { startServer } from '../server/index';

const program = new Command();

program
  .name('sift')
  .description('Sift before you commit. A lightweight local diff viewer.')
  .version('1.0.0')
  .argument('[path]', 'Target directory path (defaults to current directory)', process.cwd())
  .option('-o, --open', 'Open the browser automatically')
  .action(async (targetPath, options) => {
    try {
      console.log(`Resolving repository at: ${targetPath}`);
      const repoRoot = resolveRepoRoot(targetPath);
      console.log(`Repository root identified: ${repoRoot}`);

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
