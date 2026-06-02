import { exec } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

/**
 * Launches the Sift macOS application using its bundle identifier.
 * Throws an error if the platform is not macOS, or if the application is not installed.
 */
export async function openApp(repoId?: string): Promise<void> {
  const platform = os.platform();

  if (platform !== 'darwin') {
    throw new Error('The --app option is only supported on macOS.');
  }

  const execAsync = promisify(exec);

  try {
    // Bundle ID must stay in sync with electron-builder.yml `appId`.
    const command = repoId
      ? `open -b net.ytakahashi.sift --args --repo-id=${repoId}`
      : 'open -b net.ytakahashi.sift';
    await execAsync(command);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to open Sift application: ${detail}`, { cause: error });
  }
}
