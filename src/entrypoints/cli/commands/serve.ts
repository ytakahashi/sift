import { Command } from 'commander';

export interface ServeCommandDependencies {
  startServer: () => Promise<string>;
}

export function createServeCommand(dependencies: ServeCommandDependencies): Command {
  return new Command('serve').description('Start the local Sift server').action(async () => {
    const url = await dependencies.startServer();
    console.log(`Server started at ${url}`);
    console.log(`Open ${url} in your browser to view the diff.`);
  });
}
