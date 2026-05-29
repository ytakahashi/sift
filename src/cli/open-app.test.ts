import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openApp } from './open-app';
import os from 'node:os';
import { exec } from 'node:child_process';

vi.mock('node:os');
vi.mock('node:child_process', () => {
  return {
    exec: vi.fn(),
  };
});

describe('openApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw an error if the platform is not darwin', async () => {
    // Given
    vi.mocked(os.platform).mockReturnValue('linux');

    // When & Then
    await expect(openApp()).rejects.toThrow('The --app option is only supported on macOS.');
  });

  it('should call exec with correct command on macOS', async () => {
    // Given
    vi.mocked(os.platform).mockReturnValue('darwin');
    const mockExec = vi.fn((_cmd, cb) => cb(null, { stdout: '', stderr: '' }));
    vi.mocked(exec).mockImplementation(mockExec as unknown as typeof exec);

    // When
    await expect(openApp()).resolves.not.toThrow();

    // Then
    expect(mockExec).toHaveBeenCalledWith('open -b net.ytakahashi.sift', expect.any(Function));
  });

  it('should throw an error if the app fails to open', async () => {
    // Given
    vi.mocked(os.platform).mockReturnValue('darwin');
    const mockExec = vi.fn((_cmd, cb) => cb(new Error('Command failed')));
    vi.mocked(exec).mockImplementation(mockExec as unknown as typeof exec);

    // When & Then
    await expect(openApp()).rejects.toThrow('Failed to open Sift application: Command failed');
  });
});
