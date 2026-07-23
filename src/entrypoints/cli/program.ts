import { Command } from 'commander';
import { APP_INFO } from '../../server/app-info';
import type { AddCommandDependencies } from './commands/add';
import { createAddCommand } from './commands/add';
import type { McpCommandDependencies } from './commands/mcp';
import { createMcpCommand } from './commands/mcp';
import type { OpenCommandDependencies } from './commands/open';
import { createOpenCommand } from './commands/open';
import type { ServeCommandDependencies } from './commands/serve';
import { createServeCommand } from './commands/serve';

export type CliDependencies = OpenCommandDependencies &
  AddCommandDependencies &
  ServeCommandDependencies &
  McpCommandDependencies;

export function createCliProgram(dependencies: CliDependencies): Command {
  const program = new Command()
    .name(APP_INFO.productName)
    .description(APP_INFO.description)
    .version(APP_INFO.version)
    .action(() => {
      program.outputHelp();
    });

  program.addCommand(createOpenCommand(dependencies));
  program.addCommand(createAddCommand(dependencies));
  program.addCommand(createServeCommand(dependencies));
  program.addCommand(createMcpCommand(dependencies));

  return program;
}
