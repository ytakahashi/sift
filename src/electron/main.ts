import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRepositoryPath } from '../domain/repository/repository-route';
import { startServerWithHandle, type StartedServer } from '../server/index';

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

function ensureServer(): Promise<StartedServer> {
  serverPromise ??= startServerWithHandle({ clientDir });
  return serverPromise;
}

async function launch(): Promise<void> {
  const { url } = await ensureServer();

  let targetUrl = url;
  const repoIdArg = process.argv.find((arg) => arg.startsWith('--repo-id='));
  if (repoIdArg) {
    const repoId = repoIdArg.split('=')[1];
    if (repoId) {
      targetUrl = `${url}${buildRepositoryPath(repoId)}`;
    }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadURL(targetUrl);
}

app
  .whenReady()
  .then(launch)
  .catch((error: unknown) => {
    console.error('Failed to launch Sift:', error);
    app.exit(1);
  });

// macOS: re-open window when Dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void launch();
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
