import type { RepositoryId } from '../../domain/repository/repository';

/**
 * Pure decision logic for delivering "open this repository" intents to the
 * single Sift window.
 *
 * Electron wiring (`BrowserWindow`, `ipcMain`, `app`) lives in `main.ts`; this
 * module only describes *what* should happen for a given state so the branching
 * can be unit tested without an Electron runtime.
 */

/**
 * Open intents that arrived before `app` became ready, i.e. before any window
 * can be created.
 *
 * - `initialRepoId` is the first repository requested at launch. It is used as
 *   the initial route when the window is created, so it must not be queued.
 * - `pendingRepoIds` holds any later requests, flushed to the renderer once it
 *   signals readiness.
 */
export interface PreReadyOpenState {
  initialRepoId: RepositoryId | null;
  pendingRepoIds: RepositoryId[];
}

/**
 * Folds an open intent that arrived before the app was ready into the pre-ready
 * state. The first repository becomes the initial route; subsequent ones are
 * queued. A `null` intent (selection / focus only) carries no repository and
 * leaves the state unchanged.
 */
export function recordPreReadyIntent(
  state: PreReadyOpenState,
  repoId: RepositoryId | null,
): PreReadyOpenState {
  if (repoId === null) {
    return state;
  }
  if (state.initialRepoId === null) {
    return { ...state, initialRepoId: repoId };
  }
  return { ...state, pendingRepoIds: [...state.pendingRepoIds, repoId] };
}

/**
 * What should happen for an open intent once the app is ready and the target
 * window has been ensured/focused.
 *
 * - `focus-only`: no repository was requested; the window is just focused.
 * - `load-initial`: the window was just created with the repository as its
 *   initial route, so no further navigation is needed.
 * - `send`: the running renderer is ready; deliver the intent over IPC now.
 * - `queue`: the renderer is not ready yet; hold the intent until it is.
 */
export type OpenDeliveryAction =
  | { type: 'focus-only' }
  | { type: 'load-initial' }
  | { type: 'send'; repoId: RepositoryId }
  | { type: 'queue'; repoId: RepositoryId };

/**
 * Resolves how a running-app open intent should be delivered.
 *
 * `canSend` reflects whether the renderer has completed its ready handshake; a
 * freshly created window is never ready, but in that case `windowAlreadyExists`
 * is `false` and the repository is shown via its initial route instead.
 */
export function resolveOpenDeliveryAction(input: {
  repoId: RepositoryId | null;
  windowAlreadyExists: boolean;
  canSend: boolean;
}): OpenDeliveryAction {
  if (input.repoId === null) {
    return { type: 'focus-only' };
  }
  if (!input.windowAlreadyExists) {
    return { type: 'load-initial' };
  }
  return input.canSend
    ? { type: 'send', repoId: input.repoId }
    : { type: 'queue', repoId: input.repoId };
}
