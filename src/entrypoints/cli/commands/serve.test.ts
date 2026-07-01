import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServeCommandDependencies } from './serve';
import { createServeCommand } from './serve';

function createDependencies(): ServeCommandDependencies {
  return {
    startServer: vi.fn().mockResolvedValue({ owned: true, url: 'http://127.0.0.1:49321' }),
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

  it('does not print "Server started" when reusing an already-running server', async () => {
    // Given
    const dependencies = createDependencies();
    vi.mocked(dependencies.startServer).mockResolvedValue({
      owned: false,
      url: 'http://127.0.0.1:49321',
    });
    const command = createServeCommand(dependencies);

    // When
    await command.parseAsync([], { from: 'user' });

    // Then
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Server started'));
    expect(console.log).toHaveBeenCalledWith(
      'Open http://127.0.0.1:49321 in your browser to view the diff.',
    );
  });
});
