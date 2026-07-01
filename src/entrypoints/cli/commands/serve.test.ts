import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServeCommandDependencies } from './serve';
import { createServeCommand } from './serve';

function createDependencies(): ServeCommandDependencies {
  return {
    startServer: vi.fn().mockResolvedValue('http://127.0.0.1:49321'),
  };
}

describe('createServeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('starts the server and prints the browser URL', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createServeCommand(dependencies);

    // When
    await command.parseAsync([], { from: 'user' });

    // Then
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith('Server started at http://127.0.0.1:49321');
    expect(console.log).toHaveBeenCalledWith(
      'Open http://127.0.0.1:49321 in your browser to view the diff.',
    );
  });
});
