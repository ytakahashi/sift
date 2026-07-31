# AGENTS.md

## Project Overview

Sift is a lightweight local Git diff viewer. It is designed to run on the user's machine and avoid
sending repository data externally.

See [ARCHITECTURE.md](ARCHITECTURE.md) for layers, dependency rules, and layer-specific testing
rules.

## Build & Test Commands

This project uses **pnpm** as its package manager. See `package.json` for defined commands.

Dependencies are pinned to exact versions. `savePrefix: ''` in `pnpm-workspace.yaml` enforces this
for `pnpm add`; keep it in mind when editing `package.json` by hand.

## Coding Style Guidelines

### TypeScript

- When intentionally discarding an error, bind it as `_error: unknown` rather than omitting the
  binding entirely (`catch { ... }`).

### Code Comments

- Add comments to explain user scenarios and design rationale when necessary to provide context for
  complex logic.
- In unit tests, add explanatory comments if the verification items or expected values are not
  intuitive, so readers can understand the intent without tracing the full component lifecycle.
  - e.g., when testing a controlled component's behavior without rerendering

### Testing

- Use **Given / When / Then** style with explicit comment blocks to structure test cases for better
  readability.
- Tests do no real I/O by default: mock or inject everything that crosses the process boundary — Git
  CLI adapters, filesystem calls, network requests, child processes — so that no result depends on
  the machine the suite runs on. Importing source, or repository-committed data is not I/O in this
  sense. How many real modules a test composes is not the criterion: a composition root is tested by
  wiring the real thing and mocking only the boundary.
- A test that genuinely needs real I/O is named `*.integration.test.ts`; `vitest.config.ts` puts
  those in their own project.

### Imports

- Do **not** add `.js` extensions to import paths. The bundler (Vite / esbuild) resolves `.ts` files
  directly.

## Implementation Checklist

After completing any implementation task, ensure the following all pass:

```bash
pnpm run format    # Prettier check passes (pnpm run format:fix to apply)
pnpm run lint      # ESLint check passes (pnpm run lint:fix to apply)
pnpm run typecheck # TypeScript type checks pass
pnpm run test      # All test cases pass
pnpm run build     # Production build succeeds
```
