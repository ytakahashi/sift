import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('siftDesktop', {
  notifyReady: (): void => {
    ipcRenderer.send('renderer-ready');
  },
  onOpenRepository: (listener: (repoId: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, repoId: unknown): void => {
      if (typeof repoId === 'string' && repoId.length > 0) {
        listener(repoId);
      }
    };

    ipcRenderer.on('repository-open-requested', handler);
    return (): void => {
      ipcRenderer.removeListener('repository-open-requested', handler);
    };
  },
});
