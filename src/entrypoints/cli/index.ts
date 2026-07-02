import { resolveRepoRoot } from './resolve-repo';
import { openBrowser } from './open-browser';
import { openApp } from './open-app';
import {
  createRegisteredRepositoryLister,
  createRepositoryConfigUpdater,
  startServer,
} from '../../server/index';
import { resolveRepositoryIdForOpen } from './resolve-repository-for-open';
import { selectRepositoryInteractively } from './select-repository';
import { createCliProgram } from './program';

const program = createCliProgram({
  createRepositoryConfigUpdater,
  listRegisteredRepositories: createRegisteredRepositoryLister().listRegisteredRepositories,
  openApp,
  openBrowser,
  resolveRepoRoot,
  resolveRepositoryIdForOpen,
  selectRepository: selectRepositoryInteractively,
  startServer,
});

try {
  await program.parseAsync(process.argv);
} catch (error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${msg}`);
  process.exit(1);
}
