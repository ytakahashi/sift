export {};

declare global {
  interface Window {
    siftDesktop?: {
      notifyReady: () => void;
      onOpenRepository: (listener: (repoId: string) => void) => () => void;
    };
  }
}
