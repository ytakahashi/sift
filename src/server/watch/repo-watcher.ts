export interface RepoWatcher {
  stop: () => Promise<void>;
}
