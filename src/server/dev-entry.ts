import { createServerRuntime } from './server-runtime';

// Entry module for `@hono/vite-dev-server` (see vite.config.ts). The runtime is
// created at import time because the plugin consumes the default export as the
// app; it lives for the whole Vite dev server process, which is why it is never
// stopped. Keep this out of index.ts so CLI and Electron imports stay free of
// this side effect.
const runtime = createServerRuntime();

export default runtime.app;
