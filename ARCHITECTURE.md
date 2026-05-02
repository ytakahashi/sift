# Architecture

## Project Overview

The application consists of:

- A Hono-based server that reads local Git state through CLI adapters
- A React frontend for visualizing diffs and repository state
- A CLI entry point that resolves repositories, starts the server, and opens the browser

## Repository Layout

```text
src/
├── cli/          # CLI entry point (commander, repo resolution, browser opener)
├── electron/     # Electron main process entry point (standalone GUI app)
├── server/       # Hono HTTP server (routes, services, watch, infrastructure)
├── client/       # React frontend (application ports, infrastructure, hooks, components, styles)
├── local-config/ # Shared Node-facing local configuration paths
└── domain/       # Pure business logic and models shared across server and client
```

Top-level dependency rules:

- `domain/` contains pure logic with no framework, Node.js, browser, or infrastructure dependencies.
- `server/` depends on `domain/` and Node.js APIs. It must not import from `client/`.
- `client/` depends on `domain/` and React. It must not import from `server/` or `cli/`.
- `cli/` is the entry point. It wires together `server/` and launches the HTTP server.
- `electron/` is the Electron main process entry point. It wires together `server/` and manages the
  BrowserWindow lifecycle. Its only external dependency is the `electron` package.
- `local-config/` contains shared Node-facing local configuration helpers. It may import Node.js
  APIs, but must not import from `server/`, `client/`, or `cli/`.

## Dependency Overview

```mermaid
graph TD
    domain
    local-config["local-config"]
    server
    client
    cli
    electron

    local-config --> domain
    cli --> domain
    client --> domain
    server --> domain
    electron --> domain
    server --> local-config
    cli --> local-config
    electron --> local-config
    cli --> server
    electron --> server
```

## Domain Layer

`domain/` contains shared models and pure business logic.

For Sift's internal HTTP APIs, successful response bodies may intentionally use domain models
directly when the payload represents the same business concept without transport-specific fields.
This avoids duplicating internal API DTOs that would have the same shape as domain models.

Transport-specific concerns must stay outside `domain/`. Examples include HTTP status codes, request
parsing errors, and `{ error: string }` error response bodies. Do not add fields to domain models
solely to encode HTTP state.

Allowed dependencies:

- TypeScript standard language features
- Other files within `domain/`

Disallowed dependencies:

- Other directories, External modules, Node.js APIs, Browser runtime APIs

## CLI Layer

`cli/` contains the command-line entry point, repository resolution, local config editing, and
browser/server startup wiring.

Allowed dependencies:

- `domain/`, `server/`, `local-config/`
- Node.js APIs

Disallowed dependencies:

- `client/`, `electron/`

## Electron Layer

`electron/` contains the Electron main process entry point. It starts the Hono server via
`startServerWithHandle` from `server/` and manages the `BrowserWindow` lifecycle.

Allowed dependencies:

- `domain/`, `server/`, `local-config/`
- Electron, Node.js APIs

Disallowed dependencies:

- `client/`, `cli/`

## Client Layer

- `App.tsx` is responsible for **wiring hooks together and rendering JSX only**.
- Business logic must not be added directly to `App.tsx`; extract it to a hook or a pure function
  instead.
- `App.tsx` must not import from `infrastructure/`. Runtime dependencies are passed in through props
  from `main.tsx` or `composition/`.

### Client Responsibilities And Import Restrictions

- `application/` defines client-side ports and pure application policies.
  - It may import from `domain/`, but must not import from `hooks/`, `components/`, or
    `infrastructure/` and must not import React or browser runtime APIs.
- `composition/` wires infrastructure implementations to application ports.
  - It may import from `application/` and `infrastructure/`, but must not import from `hooks/` or
    `components/`.
- `infrastructure/` implements `application/` ports and may use browser APIs.
  - It must not import from `hooks/` or `components/`.
- `presentation/` contains pure UI and interaction logic that is not React-specific, such as layout
  calculations, display formatting, UI-only selection helpers, and style/ARIA value helpers.
  - It may import from `domain/` and from within `presentation/`.
  - It must not import from `application/`, `infrastructure/`, `composition/`, `hooks/`,
    `components/`, React, or browser runtime APIs.
- `hooks/<feature>/` contains React hooks for one feature area.
  - A hooks subdirectory may import from itself, `application/`, `presentation/`, and `domain/`.
  - It must not import from another hooks subdirectory, `components/`, or `infrastructure/`.
    Cross-feature hook composition belongs in `App.tsx` or a top-level composition hook.
- `components/<name>/` contains React UI components and component-local interaction logic.
  - A component directory may import from itself, `application/`, `presentation/`, and `domain/`.
  - It may import reusable UI components from another `components/<name>/` directory when the
    imported component is presentation-focused and does not pull in hooks, composition,
    infrastructure, or feature-specific state. For example, a diff component may reuse note UI
    components.
  - It must not import from `infrastructure/`, `composition/`, or non-colocated `hooks/`.
  - Hooks used only by a component may be colocated inside that component directory.

## Server Layer

### Server Responsibilities And Import Restrictions

- `routes/` handles HTTP routing and response shaping only.
  - It may import from `services/`, `watch/`, and `domain/`.
  - It must not import from `infrastructure/` or construct infrastructure implementations directly.
  - Runtime dependencies are passed in through route factory options from `create-app.ts`.
- `services/` defines server-side ports and error classes.
  - It may import from `domain/`.
  - It must not import from `routes/`, `infrastructure/`, or `watch/`, and must not use Node.js
    runtime APIs.
- `watch/` contains the watch subsystem interfaces and pure orchestration.
  - It may import from `domain/` and from within `watch/`.
  - It must not import from `infrastructure/`, `routes/`, or `services/`, and must not import
    chokidar, Git CLI adapters, filesystem APIs, or other Node.js runtime implementations.
  - Concrete watcher creation is injected through `CreateRepoWatchManagerOptions`.
- `infrastructure/` implements server ports and runtime adapters.
  - It is the place for accessing Node.js APIs, Git, filesystem, etc.
  - It may import from `domain/`, `services/`, and `watch/`.
  - It must not import from `routes/` or `create-app.ts`.
- `create-app.ts` is the route-level composition root.
  - It may import from all server layers except `index.ts`.
  - It wires route factories to service ports and infrastructure implementations, such as
    `RepositoryResolver`, `DiffProvider` factories, and `WorkspaceActionService` factories.
  - It should not own long-lived runtime lifecycle; pass runtime-owned resources in through
    `CreateAppOptions`.
- `index.ts` is the runtime composition root.
  - It may import from all server layers.
  - It owns server startup, static file serving, signal cleanup, config watcher lifecycle, and watch
    manager lifecycle.
  - It also exports the app instance as its default export for the Vite development server

### Server Testing

- Route tests should mock service/watch ports directly and must not instantiate infrastructure
  implementations.
- Avoid tests that require real Git repositories or filesystem access. Infrastructure tests should
  mock Node.js APIs, Git CLI adapters, filesystem calls, chokidar, and other runtime dependencies.
