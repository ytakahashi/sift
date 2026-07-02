import { Command } from 'commander';
import type { StartServerResult } from '../../../server/index';

export interface ServeCommandDependencies {
  startServer: () => Promise<StartServerResult>;
}

export function createServeCommand(dependencies: ServeCommandDependencies): Command {
  return new Command('serve').description('Start the local Sift server').action(async () => {
    const { owned, url } = await dependencies.startServer();
    if (owned) {
      console.log(`Server started at ${url}`);
    }
    console.log(`Open ${url} in your browser to view the diff.`);
  });
}
