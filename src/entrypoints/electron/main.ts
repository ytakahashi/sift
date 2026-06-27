import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRepositoryPath } from '../../domain/repository/repository-route';
import { parseRepositoryIdFromAppUrl, SIFT_URL_SCHEME } from '../shared/repository-app-url';
import { startServerWithHandle, type StartedServer } from '../../server/index';

// Resolve dist/client path, absorbing dev / packaged differences.
function resolveClientDir(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'dist', 'client');
  }
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '../../dist/client');
}

const clientDir = resolveClientDir();
let serverPromise: Promise<StartedServer> | null = null;
let mainWindow: BrowserWindow | null = null;
// Repository requested via a sift:// URL that arrived before the app was ready.
// Used as the initial target on launch and remembered for Dock re-activation.
let pendingRepoId: string | null = null;

function ensureServer(): Promise<StartedServer> {
  serverPromise ??= startServerWithHandle({ clientDir });
  return serverPromise;
}

function buildTargetUrl(baseUrl: string, repoId: string | null): string {
  return repoId ? `${baseUrl}${buildRepositoryPath(repoId)}` : baseUrl;
}

/**
 * Opens, or navigates the existing window to, the given repository.
 *
 * A single window is reused so that a sift:// open request received while the
 * app is already running navigates the current window instead of spawning a new
 * one. Centralizing navigation here keeps cold start, URL handling, and Dock
 * re-activation consistent.
 */
async function showRepository(repoId: string | null): Promise<void> {
  const { url } = await ensureServer();
  const targetUrl = buildTargetUrl(url, repoId);

  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  // Known limitation: this performs a full document navigation even when the
  // window already exists, so an already-running app reloads the whole renderer
  // on every sift:// open. Repository tabs live only in client memory
  // (useRepositoryTabs) and are reseeded solely from the current route, so the
  // reload clears the tab bar and leaves just the tab for `repoId`. Opening into
  // the existing tab set would require SPA-internal navigation (e.g. IPC to push
  // history + open a tab) instead of loadURL for the already-running case.
  await mainWindow.loadURL(targetUrl);

  // Bring the window to the front for the already-running case.
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

// Register this app as the handler for sift:// URLs. macOS uses the bundle's
// Info.plist (generated from electron-builder `protocols`) for the packaged
// app; this call covers the unpackaged dev process.
app.setAsDefaultProtocolClient(SIFT_URL_SCHEME);

// macOS delivers sift:// URLs here, both on cold start and while running.
app.on('open-url', (event, urlString) => {
  event.preventDefault();
  pendingRepoId = parseRepositoryIdFromAppUrl(urlString);
  // Before `ready`, the window cannot be created yet; the queued request is
  // applied by the whenReady handler below. While running, navigate now.
  if (app.isReady()) {
    void showRepository(pendingRepoId);
  }
});

app
  .whenReady()
  .then(() => showRepository(pendingRepoId))
  .catch((error: unknown) => {
    console.error('Failed to launch Sift:', error);
    app.exit(1);
  });

// macOS: re-open window when Dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void showRepository(pendingRepoId);
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// On quit: stop the server only if this process owns it
app.on('before-quit', (event) => {
  event.preventDefault();
  const cleanup =
    serverPromise
      ?.then(async ({ owned, stop }) => {
        if (owned) await stop();
      })
      .catch((e: unknown) => {
        console.error('Failed to stop Sift server:', e);
      }) ?? Promise.resolve();
  void cleanup.finally(() => app.exit(0));
});
