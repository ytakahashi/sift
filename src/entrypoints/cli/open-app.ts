import { exec } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { buildRepositoryAppUrl } from '../shared/repository-app-url';

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
    // When a repository is targeted, open it via the sift:// URL scheme so the
    // request reaches an already-running instance (the bundle-id `--args` path
    // only delivers arguments on a fresh launch). Without a target, just bring
    // the app to the foreground by its bundle ID (kept in sync with
    // electron-builder.yml `appId`).
    const command = repoId
      ? `open ${buildRepositoryAppUrl(repoId)}`
      : 'open -b net.ytakahashi.sift';
    await execAsync(command);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to open Sift application: ${detail}`, { cause: error });
  }
}
