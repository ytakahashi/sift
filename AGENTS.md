# AGENTS.md

## Project Overview

Sift is a lightweight, local Git diff viewer, runs entirely on the user's machine — no data is sent
externally.

The application consists of:

- Hono-based server that reads Git state via CLI
- React frontend for visualizing diffs
- CLI entry point that bundles everything for standalone use

### Repository Layout

```
src/
├── cli/          # CLI entry point (commander, repo resolution, browser opener)
├── server/       # Hono HTTP server (routes, services, watchers, utils)
├── client/       # React frontend (application ports, infrastructure, hooks, components, styles)
└── domain/       # Pure business logic shared across server & client
```

- **`domain/`** contains pure logic **with no framework dependencies**. It is imported by both
  `server/` and `client/`.
- **`server/`** depends on `domain/` and Node.js APIs. It must not import from `client/`.
- **`client/`** depends on `domain/` and React. It must not import from `server/` or `cli/`.
- **`cli/`** is the production entry point. It wires together `server/` and launches the HTTP
  server.

## Build & Test Commands

This project uses **pnpm** as its package manager. See `package.json` for defined commands.

## Coding Style Guidelines

### Formatting & Linting

- Prettier / ESLint — see `.prettierrc` and `eslint.config.js` for configuration.

### TypeScript

- Strict mode is enabled (`"strict": true`).
- Use explicit types for function parameters and return values in `domain/` and `server/`.
- Use `unknown` (not `any`) in `catch` blocks, with `instanceof Error` guards.

### Code Comments

- Add comments to explain user scenarios and design rationale when necessary to provide context for
  complex logic.
- In unit tests, add explanatory comments if the verification items or expected values are not
  intuitive, so readers can understand the intent without tracing the full component lifecycle.
  - e.g., when testing a controlled component's behavior without rerendering

### Testing

- Test files are colocated with source files.
- Test runner is Vitest (config: `vitest.config.ts`).
- Tests use explicit imports (`import { describe, it, expect } from 'vitest'`), not globals.
- Use **Given / When / Then** style with explicit comment blocks to structure test cases for better
  readability.
- Avoid tests that require real Git repositories or filesystem access.

### App.tsx

- `App.tsx` is responsible for **wiring hooks together and rendering JSX only**.
- Business logic must not be added directly to `App.tsx`; extract it to a hook or a pure function
  instead.
- `App.tsx` must not import from `infrastructure/`. Runtime dependencies are passed in through props
  from `main.tsx` or `composition/`.

### Imports

- Use relative imports within each layer (`./`, `../`).
- Do **not** add `.js` extensions to import paths. The bundler (Vite / esbuild) resolves `.ts` files
  directly.
- Do **not** import across layer boundaries except as documented above (e.g., `client/` must not
  import from `server/`).
- Within `client/`, each sub-directory has additional import restrictions:
  - `application/` defines client-side ports and pure application policies. It may import from
    `domain/`, but must not import from `hooks/`, `components/`, or `infrastructure/`. It must not
    import React or browser runtime APIs.
  - `composition/` wires infrastructure implementations to application ports for the client entry
    point. It may import from `application/` and `infrastructure/`, but must not import from
    `hooks/` or `components/`.
  - `infrastructure/` implements `application/` ports and may use browser APIs such as `fetch` and
    `EventSource`. `infrastructure/http/` contains request-response clients;
    `infrastructure/event/` contains event subscription sources. Infrastructure must not import from
    `hooks/` or `components/`.
  - `presentation/` contains pure UI and interaction logic that is not React-specific, such as
    layout calculations, display formatting, UI-only selection helpers, and style/ARIA value
    helpers. It may import from `domain/` and from within `presentation/`. It must not import from
    `application/`, `infrastructure/`, `composition/`, `hooks/`, `components/`, React, or browser
    runtime APIs.
  - `hooks/<feature>/` contains React hooks for one feature area. A hooks subdirectory may import
    from itself, from `application/`, from `presentation/`, and from `domain/`. It must not import
    from another hooks subdirectory, `components/`, or `infrastructure/`. Cross-feature hook
    composition belongs in `App.tsx` or a top-level composition hook.
  - `components/<name>/` may only import from within the same component directory, from
    `presentation/`, and from `domain/`. Components must not import from `application/`,
    `infrastructure/`, `composition/`, or `hooks/` unless the hook is colocated inside the same
    component directory.

## Implementation Checklist

After completing any implementation task, ensure the following all pass:

```bash
pnpm run format    # Prettier check passes
pnpm run lint      # ESLint check passes
pnpm run test      # All test cases pass
pnpm run build     # Production build succeeds
```
