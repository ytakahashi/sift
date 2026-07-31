// Architecture boundaries, enforced. This file is the executable counterpart of
// ARCHITECTURE.md: every dependency edge allowed there is listed here, and
// anything not listed is an error (the rule runs with `default: 'disallow'`).
//
// Only local, folder-level edges are enforced here. Bans on external and Node
// runtime modules live in eslint.config.js as `no-restricted-imports`, and the
// few file-level rules (`create-app.ts` vs `index.ts`) are not tool-enforced.
import boundaries from 'eslint-plugin-boundaries';

const element = (type, captured) => ({ element: captured ? { type, captured } : { type } });

/** Layers every element may depend on, since domain/ is pure shared logic. */
const domain = element('domain');
const projectMetadata = { file: { categories: 'project-metadata' } };

export const boundariesConfig = {
  files: ['src/**/*.{ts,tsx}'],
  plugins: { boundaries },
  settings: {
    // Resolve extensionless TypeScript imports so dependencies can be assigned
    // to elements. The no-unknown rules below fail closed if resolution or
    // classification stops working.
    'import/resolver': {
      node: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
    },
    // Ordered from most to least specific: the first matching descriptor wins.
    'boundaries/elements': [
      // --- client -------------------------------------------------------
      // hooks and components are captured per feature/component so that the
      // "must not import a sibling" rules can be written once, generically.
      {
        type: 'client-hooks',
        pattern: 'src/client/hooks/*',
        capture: ['family'],
        partialMatch: false,
      },
      // Files directly under hooks/ are the cross-feature composition hooks.
      // They need their own type: without it they fall through to client-root
      // and silently inherit its far broader allow list.
      { type: 'client-hooks-root', pattern: 'src/client/hooks', partialMatch: false },
      {
        type: 'client-components',
        pattern: 'src/client/components/*',
        capture: ['name'],
        partialMatch: false,
      },
      { type: 'client-pages', pattern: 'src/client/pages', partialMatch: false },
      { type: 'client-application', pattern: 'src/client/application', partialMatch: false },
      { type: 'client-composition', pattern: 'src/client/composition', partialMatch: false },
      { type: 'client-infrastructure', pattern: 'src/client/infrastructure', partialMatch: false },
      { type: 'client-presentation', pattern: 'src/client/presentation', partialMatch: false },
      // App.tsx / main.tsx and the remaining non-layer files (styles, types).
      { type: 'client-root', pattern: 'src/client', partialMatch: false },

      // --- server -------------------------------------------------------
      // The HTTP wire contract (error codes, health identity). Depended on by
      // routes/, by the server root, and by mcp/ as an HTTP client; depends on
      // nothing but domain/.
      { type: 'server-contract', pattern: 'src/server/contract', partialMatch: false },
      { type: 'server-routes', pattern: 'src/server/routes', partialMatch: false },
      { type: 'server-services', pattern: 'src/server/services', partialMatch: false },
      { type: 'server-watch', pattern: 'src/server/watch', partialMatch: false },
      { type: 'server-infrastructure', pattern: 'src/server/infrastructure', partialMatch: false },
      // create-app.ts, index.ts, and utilities shared with mcp/ (health probe,
      // port resolver).
      { type: 'server-root', pattern: 'src/server', partialMatch: false },

      // --- other layers -------------------------------------------------
      { type: 'mcp', pattern: 'src/mcp', partialMatch: false },
      { type: 'domain', pattern: 'src/domain', partialMatch: false },
      // shared/ is the only sanctioned channel between sibling entry points,
      // so it must be its own type rather than one more `entrypoint`.
      { type: 'entrypoint-shared', pattern: 'src/entrypoints/shared', partialMatch: false },
      {
        type: 'entrypoint',
        pattern: 'src/entrypoints/*',
        capture: ['name'],
        partialMatch: false,
      },
    ],
    // package.json is read at runtime by server/app-info.ts. Classifying this
    // known non-source dependency keeps no-unknown-dependencies strict for
    // every other local target.
    'boundaries/files': [{ category: 'project-metadata', pattern: 'package.json' }],
  },
  rules: {
    'boundaries/no-unknown-files': 'error',
    'boundaries/no-unknown-dependencies': 'error',
    'boundaries/dependencies': [
      'error',
      {
        default: 'disallow',
        message: '{{ from.type }} is not allowed to import {{ to.type }} (see ARCHITECTURE.md)',
        policies: [
          // --- client ---------------------------------------------------
          {
            from: [element('client-root')],
            allow: [
              element('client-pages'),
              element('client-components'),
              element('client-hooks'),
              element('client-hooks-root'),
              element('client-presentation'),
              element('client-application'),
              element('client-composition'),
              element('client-infrastructure'),
              domain,
            ],
          },
          {
            from: [element('client-pages')],
            allow: [
              element('client-hooks'),
              element('client-hooks-root'),
              element('client-components'),
              element('client-presentation'),
              element('client-application'),
              element('client-composition'),
              domain,
            ],
          },
          { from: [element('client-application')], allow: [domain] },
          {
            from: [element('client-composition')],
            allow: [element('client-application'), element('client-infrastructure'), domain],
          },
          {
            from: [element('client-infrastructure')],
            allow: [element('client-application'), domain],
          },
          { from: [element('client-presentation')], allow: [domain] },
          {
            from: [element('client-hooks')],
            allow: [element('client-application'), element('client-presentation'), domain],
          },
          {
            // Same constraints as a feature hook, plus the one thing that is
            // its reason to exist: composing hooks across features.
            from: [element('client-hooks-root')],
            allow: [
              element('client-hooks'),
              element('client-application'),
              element('client-presentation'),
              domain,
            ],
          },
          {
            // Imports inside the same feature are internal to the element and
            // never checked, so this only catches sibling features. Stated as
            // an explicit disallow to carry its own message.
            from: [element('client-hooks')],
            disallow: [element('client-hooks')],
            message:
              'hooks/{{ from.captured.family }} may not import hooks/{{ to.captured.family }}; compose cross-feature hooks in pages/',
          },
          {
            // A component may reuse a presentation-focused component from
            // another component directory.
            from: [element('client-components')],
            allow: [
              element('client-components'),
              element('client-application'),
              element('client-presentation'),
              domain,
            ],
          },

          // --- server ---------------------------------------------------
          { from: [element('server-contract')], allow: [domain] },
          {
            from: [element('server-routes')],
            allow: [
              element('server-contract'),
              element('server-services'),
              element('server-watch'),
              domain,
            ],
          },
          { from: [element('server-services')], allow: [domain] },
          { from: [element('server-watch')], allow: [domain] },
          {
            from: [element('server-infrastructure')],
            allow: [element('server-services'), element('server-watch'), domain],
          },
          {
            from: [element('server-root')],
            allow: [
              element('server-contract'),
              element('server-routes'),
              element('server-services'),
              element('server-watch'),
              element('server-infrastructure'),
              domain,
              projectMetadata,
            ],
          },

          // --- mcp ------------------------------------------------------
          {
            // A thin protocol adapter: an HTTP client of server/, so it reads
            // the wire contract from server-contract and uses shared utilities
            // such as the port resolver and health probe from the server root.
            // It never reaches into routes/, services/, or infrastructure/.
            from: [element('mcp')],
            allow: [element('server-contract'), element('server-root'), domain],
          },

          // --- entry points ---------------------------------------------
          { from: [element('entrypoint-shared')], allow: [domain] },
          {
            from: [element('entrypoint')],
            allow: [
              element('entrypoint-shared'),
              element('server-root'),
              element('server-infrastructure'),
              domain,
            ],
          },
          {
            from: [element('entrypoint')],
            disallow: [element('entrypoint')],
            message:
              'entrypoints/{{ from.captured.name }} may not import entrypoints/{{ to.captured.name }}; share code through entrypoints/shared/',
          },
          {
            // Only the CLI hosts the mcp subcommand.
            from: [element('entrypoint', { name: 'cli' })],
            allow: [element('mcp')],
          },
        ],
      },
    ],
  },
};
