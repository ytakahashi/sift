# AGENTS.md

## Project Overview

Sift is a lightweight local Git diff viewer. It is designed to run on the user's machine and avoid
sending repository data externally.

The application consists of:

- Hono-based server that reads local Git state through CLI adapters
- React frontend for visualizing diffs
- CLI entry point that bundles everything for standalone use

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture information.

## Build & Test Commands

This project uses **pnpm** as its package manager. See `package.json` for defined commands.

## Coding Style Guidelines

### TypeScript

- Strict mode is enabled (`"strict": true`).
- Use explicit types for function parameters and return values.
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
- Follow layer-specific testing rules in [ARCHITECTURE.md](ARCHITECTURE.md).

### Imports

- Use relative imports within each layer (`./`, `../`).
- Do **not** add `.js` extensions to import paths. The bundler (Vite / esbuild) resolves `.ts` files
  directly.
- Follow layer boundaries in [ARCHITECTURE.md](ARCHITECTURE.md).

## Implementation Checklist

After completing any implementation task, ensure the following all pass:

```bash
pnpm run format    # Prettier check passes
pnpm run lint      # ESLint check passes
pnpm run typecheck # TypeScript type checks pass
pnpm run test      # All test cases pass
pnpm run build     # Production build succeeds
```
