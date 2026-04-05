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
  .action(async (targetPath) => {
    try {
      console.log(`Resolving repository at: ${targetPath}`);
      const repoRoot = resolveRepoRoot(targetPath);
      console.log(`Repository root identified: ${repoRoot}`);

      // Start the local development/production server
      const url = await startServer(repoRoot);
      console.log(`Server started at ${url}`);

      // Open browser
      openBrowser(url);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
