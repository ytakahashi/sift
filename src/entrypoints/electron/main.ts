import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RepositoryId } from '../../domain/repository/repository';
import { buildRepositoryPath } from '../../domain/repository/repository-route';
import {
  findRepositoryIdFromArgv,
  parseRepositoryIdFromAppUrl,
  SIFT_URL_SCHEME,
} from '../shared/repository-app-url';
import { recordPreReadyIntent, resolveOpenDeliveryAction } from './open-repository-delivery';
import { startServerWithHandle, type StartedServer } from '../../server/index';

function resolveDistDir(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'dist');
  }
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..');
}

// Resolve dist/client path, absorbing dev / packaged differences.
function resolveClientDir(): string {
  return path.join(resolveDistDir(), 'client');
}

function resolvePreloadPath(): string {
  return path.join(resolveDistDir(), 'electron', 'preload.cjs');
}

const clientDir = resolveClientDir();
const preloadPath = resolvePreloadPath();
let serverPromise: Promise<StartedServer> | null = null;
let mainWindow: BrowserWindow | null = null;
let readyWebContentsId: number | null = null;
let initialRepoIdBeforeReady: RepositoryId | null = null;
let pendingRepoIds: RepositoryId[] = [];

function ensureServer(): Promise<StartedServer> {
  serverPromise ??= startServerWithHandle({ clientDir });
  return serverPromise;
}

function buildTargetUrl(baseUrl: string, repoId: RepositoryId | null): string {
  return repoId ? `${baseUrl}${buildRepositoryPath(repoId)}` : baseUrl;
}

function focusWindow(win: BrowserWindow): void {
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}

async function loadInitialUrl(win: BrowserWindow, repoId: RepositoryId | null): Promise<void> {
  const { url } = await ensureServer();
  await win.loadURL(buildTargetUrl(url, repoId));
}

async function ensureMainWindow(initialRepoId: RepositoryId | null): Promise<BrowserWindow> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    readyWebContentsId = null;
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: preloadPath,
      },
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
      readyWebContentsId = null;
      pendingRepoIds = [];
    });
    await loadInitialUrl(mainWindow, initialRepoId);
  }

  return mainWindow;
}

function canSendRepositoryOpenRequest(win: BrowserWindow): boolean {
  return !win.isDestroyed() && readyWebContentsId === win.webContents.id;
}

function flushPendingRepositoryOpenRequests(): void {
  const win = mainWindow;
  if (!win || !canSendRepositoryOpenRequest(win)) {
    return;
  }

  const repoIds = pendingRepoIds;
  pendingRepoIds = [];
  for (const repoId of repoIds) {
    win.webContents.send('repository-open-requested', repoId);
  }
}

async function handleOpenRepositoryRequest(repoId: RepositoryId | null): Promise<void> {
  if (!app.isReady()) {
    const next = recordPreReadyIntent(
      { initialRepoId: initialRepoIdBeforeReady, pendingRepoIds },
      repoId,
    );
    initialRepoIdBeforeReady = next.initialRepoId;
    pendingRepoIds = next.pendingRepoIds;
    return;
  }

  const windowAlreadyExists = mainWindow !== null && !mainWindow.isDestroyed();
  const win = await ensureMainWindow(windowAlreadyExists ? null : repoId);
  focusWindow(win);

  const action = resolveOpenDeliveryAction({
    repoId,
    windowAlreadyExists,
    canSend: canSendRepositoryOpenRequest(win),
  });

  switch (action.type) {
    case 'focus-only':
    case 'load-initial':
      // The window is already focused; a newly created window shows the repo
      // via its initial route, so nothing further is required.
      return;
    case 'send':
      win.webContents.send('repository-open-requested', action.repoId);
      return;
    case 'queue':
      pendingRepoIds.push(action.repoId);
      return;
  }
}

// Register this app as the handler for sift:// URLs. macOS uses the bundle's
// Info.plist (generated from electron-builder `protocols`) for the packaged
// app; this call covers the unpackaged dev process.
app.setAsDefaultProtocolClient(SIFT_URL_SCHEME);

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  ipcMain.on('renderer-ready', (event) => {
    const win = mainWindow;
    if (!win || win.isDestroyed() || event.sender.id !== win.webContents.id) {
      return;
    }
    readyWebContentsId = event.sender.id;
    flushPendingRepositoryOpenRequests();
  });

  app.on('second-instance', (_event, argv) => {
    void handleOpenRepositoryRequest(findRepositoryIdFromArgv(argv));
  });

  // macOS delivers sift:// URLs here, both on cold start and while running.
  app.on('open-url', (event, urlString) => {
    event.preventDefault();
    void handleOpenRepositoryRequest(parseRepositoryIdFromAppUrl(urlString));
  });

  app
    .whenReady()
    .then(() => {
      // Consume the launch intent once; it is only meaningful before `ready`.
      const initialRepoId = initialRepoIdBeforeReady;
      initialRepoIdBeforeReady = null;
      return handleOpenRepositoryRequest(initialRepoId);
    })
    .catch((error: unknown) => {
      console.error('Failed to launch Sift:', error);
      app.exit(1);
    });

  // macOS: re-open window when Dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void handleOpenRepositoryRequest(null);
    }
  });
}

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
